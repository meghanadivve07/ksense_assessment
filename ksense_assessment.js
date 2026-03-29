
//   KSense Healthcare API Assessment
//   ----------------------------------
//   Author: Meghana Divve
//   Date: March 2026
 
//   Solution Overview:
//   - Fetches all patients from the paginated DemoMed Healthcare API
//   - Handles real-world API issues: rate limiting, intermittent failures, inconsistent data
//   - Scores each patient across 3 risk categories: Blood Pressure, Temperature, Age
//   - Builds 3 alert lists: High-Risk, Fever, and Data Quality Issues
//   - Submits results to the assessment API
 

const API_KEY = "ak_776236ff7ad056ca820cbda30e6ba1db8bb9474e239cc0c0";
const BASE_URL = "https://assessment.ksensetech.com/api";

//  Sleep helper for delays

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// Fetch with exponential backoff retry
// Handles: 429 (rate limit), 500/503 (server errors), network failures

async function fetchWithRetry(url, options = {}, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (response.ok) return await response.json();

      if ([429, 500, 503].includes(response.status)) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`  Status ${response.status} — retrying in ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`  Unexpected status ${response.status} for ${url}`);
      return null;

    } catch (err) {
      const waitMs = Math.pow(2, attempt) * 1000;
      console.log(`  Network error: ${err.message} — retrying in ${waitMs / 1000}s...`);
      await sleep(waitMs);
    }
  }

  console.error(`  All ${maxRetries} attempts failed for: ${url}`);
  return null;
}

// ------------------------------------------------------------------------------------
// STEP 1: Fetch all patients (handles pagination automatically)
// Uses limit=20 for efficiency instead of the default 5
// ------------------------------------------------------------------------------------
async function fetchAllPatients() {
  const allPatients = [];
  let page = 1;

  console.log("Fetching all patients...\n");

  while (true) {
    console.log(`  Page ${page}...`);
    const data = await fetchWithRetry(`${BASE_URL}/patients?page=${page}&limit=20`);

    if (!data) {
      console.log(`  No data returned for page ${page}. Stopping.`);
      break;
    }

    const patients = data.data || [];
    if (patients.length === 0) break;

    allPatients.push(...patients);
    console.log(`  Got ${patients.length} patients (total: ${allPatients.length})`);

    if (!data.pagination?.hasNext) break;

    page++;
    await sleep(300); 
  }

  return allPatients;
}

// ------------------------------------------------------------------------------------
// STEP 2: Risk Scoring Functions
// ------------------------------------------------------------------------------------

// 
//  -Blood Pressure Risk Scoring
//  -Expected format: "120/80" (systolic/diastolic)
//  -Rule: If systolic and diastolic fall in different stages, use the HIGHER stage
//-----------------------------------------------------------------
//  -Normal   (Systolic <120 AND Diastolic <80):     0 pts
//  -Elevated (Systolic 120-129 AND Diastolic <80):  1 pt
//  -Stage 1  (Systolic 130-139 OR Diastolic 80-89): 2 pts
//  -Stage 2  (Systolic >=140  OR Diastolic >=90):   3 pts
//  -Invalid  (missing/malformed):                   0 pts + flag


function scoreBloodPressure(bp) {
  if (!bp || typeof bp !== "string" || !bp.includes("/")) {
    return { score: 0, invalid: true };
  }

  const parts = bp.split("/");
  if (parts.length !== 2) return { score: 0, invalid: true };

  const systolic = parseFloat(parts[0].trim());
  const diastolic = parseFloat(parts[1].trim());

  // Reject non-numeric values ["INVALID", "N/A", "150/" or "/90"]
  if (isNaN(systolic) || isNaN(diastolic)) return { score: 0, invalid: true };

  let sysScore;
  if (systolic < 120) sysScore = 0;
  else if (systolic <= 129) sysScore = 1;
  else if (systolic <= 139) sysScore = 2;
  else sysScore = 3;

  // Diastolic has no "Elevated" stage — jumps from Normal (0) to Stage 1 (2)
  let diasScore;
  if (diastolic < 80) diasScore = 0;
  else if (diastolic <= 89) diasScore = 2;
  else diasScore = 3;

  return { score: Math.max(sysScore, diasScore), invalid: false };
}


//  Temperature Risk Scoring
//  Expected format: numeric value in degrees F
 
//  Normal    (<=99.5 F):       0 pts
//  Low Fever (99.6-100.9 F):   1 pt
//  High Fever (>=101.0 F):     2 pts
//  Invalid   (non-numeric strings, null, empty): 0 pts + flag
//   hasFever = true if temp >= 99.6 F (used for fever alert list)
 
function scoreTemperature(temp) {
  if (temp === null || temp === undefined || temp === "") {
    return { score: 0, invalid: true, hasFever: false };
  }

 
  if (typeof temp === "string") {
    const parsed = parseFloat(temp);
    if (isNaN(parsed)) return { score: 0, invalid: true, hasFever: false };
    temp = parsed;
  }

  if (typeof temp !== "number" || isNaN(temp)) {
    return { score: 0, invalid: true, hasFever: false };
  }

  const hasFever = temp >= 99.6;

  if (temp <= 99.5) return { score: 0, invalid: false, hasFever };
  if (temp <= 100.9) return { score: 1, invalid: false, hasFever };
  return { score: 2, invalid: false, hasFever };
}


//  Age Risk Scoring
//   Expected format: numeric value (years)
 
//  Under 40 (<40):   0 pts
//  Middle  (40-65):  1 pt
//   Senior  (>65):    2 pts
//  Invalid (non-numeric strings like "fifty-three", null, empty): 0 pts + flag
 
function scoreAge(age) {
  if (age === null || age === undefined || age === "") {
    return { score: 0, invalid: true };
  }

  // Reject words like "fifty-three", "unknown"
  if (typeof age === "string") {
    const parsed = parseFloat(age);
    if (isNaN(parsed)) return { score: 0, invalid: true };
    age = parsed;
  }

  if (typeof age !== "number" || isNaN(age)) return { score: 0, invalid: true };

  if (age < 40) return { score: 0, invalid: false };
  if (age <= 65) return { score: 1, invalid: false };
  return { score: 2, invalid: false };
}

// -------------------------------------------------------------
// STEP 3: Process all patients and build alert lists
// ------------------------------------------------------------
function processPatients(patients) {
  const highRiskPatients = [];   
  const feverPatients = [];      
  const dataQualityIssues = [];  

  console.log("\nScoring patients...\n");

  for (const patient of patients) {
    const id = patient.patient_id;

    const bp = scoreBloodPressure(patient.blood_pressure);
    const temp = scoreTemperature(patient.temperature);
    const age = scoreAge(patient.age);

    const totalRisk = bp.score + temp.score + age.score;
    const hasDataIssue = bp.invalid || temp.invalid || age.invalid;

    if (totalRisk >= 4) highRiskPatients.push(id);
    if (temp.hasFever) feverPatients.push(id);
    if (hasDataIssue) dataQualityIssues.push(id);

    const flags = [
      bp.invalid ? "BP:invalid" : null,
      temp.invalid ? "Temp:invalid" : null,
      age.invalid ? "Age:invalid" : null,
      temp.hasFever ? "FEVER" : null,
      totalRisk >= 4 ? "HIGH-RISK" : null,
    ].filter(Boolean).join(" | ");

    console.log(
      `${id} | BP:${bp.score}${bp.invalid ? "(inv)" : ""} Temp:${temp.score}${temp.invalid ? "(inv)" : ""} Age:${age.score}${age.invalid ? "(inv)" : ""} | Total:${totalRisk} | ${flags || "—"}`
    );
  }

  return { highRiskPatients, feverPatients, dataQualityIssues };
}


// STEP 4: Print summary report

function printSummary(patients, highRiskPatients, feverPatients, dataQualityIssues) {
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY REPORT");
  console.log("=".repeat(60));
  console.log(`Total patients processed : ${patients.length}`);
  console.log(`High-risk patients       : ${highRiskPatients.length}`);
  console.log(`Fever patients           : ${feverPatients.length}`);
  console.log(`Data quality issues      : ${dataQualityIssues.length}`);
  console.log("-".repeat(60));
  console.log(`High-Risk IDs  : ${highRiskPatients.join(", ")}`);
  console.log(`Fever IDs      : ${feverPatients.join(", ")}`);
  console.log(`Data Issue IDs : ${dataQualityIssues.join(", ")}`);
  console.log("=".repeat(60) + "\n");
}


// STEP 5: Submit results to the assessment API

async function submitResults(results) {
  console.log("Submitting results...\n");

  const response = await fetchWithRetry(
    `${BASE_URL}/submit-assessment`,
    {
      method: "POST",
      body: JSON.stringify(results),
    }
  );

  if (!response) {
    console.error("Submission failed.");
    return;
  }

  const { score, percentage, status, breakdown, feedback } = response.results;

  console.log("=".repeat(60));
  console.log("SUBMISSION RESULTS");
  console.log("=".repeat(60));
  console.log(`Status     : ${status}`);
  console.log(`Score      : ${score} / 100`);
  console.log(`Percentage : ${percentage}%`);
  console.log("-".repeat(60));
  console.log(`High-Risk  : ${breakdown.high_risk.score}/${breakdown.high_risk.max}`);
  console.log(`Fever      : ${breakdown.fever.score}/${breakdown.fever.max}`);
  console.log(`Data QA    : ${breakdown.data_quality.score}/${breakdown.data_quality.max}`);
  console.log("-".repeat(60));

  if (feedback.strengths.length > 0) {
    console.log("\nStrengths:");
    feedback.strengths.forEach((s) => console.log(`  ${s}`));
  }

  if (feedback.issues.length > 0) {
    console.log("\nIssues:");
    feedback.issues.forEach((i) => console.log(`  ${i}`));
  }

  console.log("\n" + "=".repeat(60));
}

 // MAIN

async function main() {
  console.log("=".repeat(60));
  console.log("  KSense DemoMed Healthcare API — Risk Assessment Tool");
  console.log("=".repeat(60) + "\n");

  const patients = await fetchAllPatients();
  console.log(`\nTotal patients fetched: ${patients.length}`);

  const { highRiskPatients, feverPatients, dataQualityIssues } = processPatients(patients);

  printSummary(patients, highRiskPatients, feverPatients, dataQualityIssues);

  await submitResults({
    high_risk_patients: highRiskPatients,
    fever_patients: feverPatients,
    data_quality_issues: dataQualityIssues,
  });
}

main().catch(console.error);