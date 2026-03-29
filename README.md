# KSense Healthcare API Assessment

This is my solution for the KSense Healthcare API coding assessment. The task was to integrate with a simulated healthcare REST API, process patient data, apply a risk scoring algorithm, and submit the results.

Scored 100% on the first submission attempt.

---

## What the assessment asked for

The API simulates real-world messiness — rate limiting, random 500 errors, paginated responses, and inconsistent data (missing fields, non-numeric values, malformed formats). The goal was to fetch all ~50 patients, score each one across three risk categories, and build alert lists based on the scores.

The three alert lists required:
- **High-risk patients** — total risk score ≥ 4
- **Fever patients** — temperature ≥ 99.6°F
- **Data quality issues** — any invalid or missing field

---

## How I approached it

The first thing I thought about was reliability. The API docs explicitly warned about rate limiting and intermittent failures, so I wrapped every request in a retry function with exponential backoff before writing any scoring logic. No point building the rest if the data fetching is fragile.

For pagination I used `limit=20` instead of the default 5 — fewer round trips, less exposure to rate limiting, same data.

The scoring itself was straightforward to implement but had some tricky edge cases, especially for blood pressure. The spec says if systolic and diastolic fall into different risk stages, use the higher one. So I score each reading independently and take the max — that way the logic is clean and easy to follow rather than trying to handle every combination with conditionals.

For data validation I kept it simple: each scoring function validates its own input and returns an `invalid` flag alongside the score. Invalid fields score 0 but still get flagged for the data quality list. This means a patient with one bad field still gets correctly scored on the other two — partial data doesn't break anything.

---

## Scoring breakdown

### Blood Pressure

| Stage | Criteria | Points |
|---|---|---|
| Normal | Systolic < 120 AND Diastolic < 80 | 0 |
| Elevated | Systolic 120–129 AND Diastolic < 80 | 1 |
| Stage 1 | Systolic 130–139 OR Diastolic 80–89 | 2 |
| Stage 2 | Systolic ≥ 140 OR Diastolic ≥ 90 | 3 |
| Invalid | Missing or malformed | 0 + flagged |

### Temperature

| Level | Criteria | Points |
|---|---|---|
| Normal | ≤ 99.5°F | 0 |
| Low Fever | 99.6–100.9°F | 1 |
| High Fever | ≥ 101.0°F | 2 |
| Invalid | Non-numeric, null, or empty | 0 + flagged |

### Age

| Group | Criteria | Points |
|---|---|---|
| Under 40 | < 40 | 0 |
| 40–65 | 40–65 | 1 |
| Over 65 | > 65 | 2 |
| Invalid | Non-numeric string, null, or empty | 0 + flagged |

Total risk score = BP + Temp + Age

---

## Running it

You need Node.js v18 or higher (uses native fetch, no dependencies).

```bash
git clone https://github.com/meghanadivve07/ksense_assessment.git
cd ksense_assessment
node ksense_assessment.js
```

It will page through all patients, print the scoring breakdown for each one, then submit and show the results.

---

## Results

```
Status     : PASS
Score      : 100 / 100
Percentage : 100%

High-Risk  : 50/50
Fever      : 25/25
Data QA    : 25/25
```

---

## Stack

Node.js — no external libraries, just native fetch.

## Results from my Terminal
=== KSense Healthcare Assessment ===

Fetching page 1...
  Got 20 patients (total: 20)
Fetching page 2...
  Got 20 patients (total: 40)
Fetching page 3...
  Got 7 patients (total: 47)

Total patients fetched: 47

DEMO001 | BP: 2 | Temp: 0 | Age: 1 | Total: 3
DEMO002 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO003 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO004 | BP: 0(inv) | Temp: 0 | Age: 1 | Total: 1 | DATA ISSUE
DEMO005 | BP: 0(inv) | Temp: 2(fever) | Age: 0 | Total: 2 | DATA ISSUE
DEMO006 | BP: 2 | Temp: 0 | Age: 2 | Total: 4
DEMO007 | BP: 3 | Temp: 0(inv) | Age: 1 | Total: 4 | DATA ISSUE
DEMO008 | BP: 2 | Temp: 2(fever) | Age: 1 | Total: 5
DEMO009 | BP: 2 | Temp: 1(fever) | Age: 0 | Total: 3
DEMO010 | BP: 3 | Temp: 0 | Age: 1 | Total: 4
DEMO012 | BP: 3 | Temp: 2(fever) | Age: 2 | Total: 7
DEMO013 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO014 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO015 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO016 | BP: 3 | Temp: 0 | Age: 1 | Total: 4
DEMO017 | BP: 2 | Temp: 0 | Age: 1 | Total: 3
DEMO018 | BP: 1 | Temp: 0 | Age: 1 | Total: 2
DEMO019 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO020 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO021 | BP: 2 | Temp: 2(fever) | Age: 0 | Total: 4
DEMO022 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO023 | BP: 0(inv) | Temp: 1(fever) | Age: 1 | Total: 2 | DATA ISSUE
DEMO024 | BP: 0(inv) | Temp: 0 | Age: 1 | Total: 1 | DATA ISSUE
DEMO025 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO026 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO027 | BP: 3 | Temp: 0 | Age: 1 | Total: 4
DEMO028 | BP: 3 | Temp: 0 | Age: 1 | Total: 4
DEMO029 | BP: 2 | Temp: 0 | Age: 0 | Total: 2
DEMO030 | BP: 1 | Temp: 0 | Age: 0 | Total: 1
DEMO031 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO032 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO033 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO034 | BP: 2 | Temp: 0 | Age: 1 | Total: 3
DEMO035 | BP: 3 | Temp: 0 | Age: 0(inv) | Total: 3 | DATA ISSUE
DEMO036 | BP: 0(inv) | Temp: 0 | Age: 1 | Total: 1 | DATA ISSUE
DEMO037 | BP: 1 | Temp: 2(fever) | Age: 0 | Total: 3
DEMO038 | BP: 0 | Temp: 2(fever) | Age: 1 | Total: 3
DEMO039 | BP: 2 | Temp: 0 | Age: 1 | Total: 3
DEMO040 | BP: 3 | Temp: 0 | Age: 1 | Total: 4
DEMO041 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO042 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO043 | BP: 3 | Temp: 0 | Age: 0(inv) | Total: 3 | DATA ISSUE
DEMO044 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO045 | BP: 3 | Temp: 0 | Age: 2 | Total: 5
DEMO046 | BP: 0 | Temp: 0 | Age: 0 | Total: 0
DEMO047 | BP: 1 | Temp: 1(fever) | Age: 0 | Total: 2
DEMO048 | BP: 3 | Temp: 0 | Age: 1 | Total: 4

=== Alert Lists ===
High-Risk Patients (score >= 4): 20 [
  'DEMO002', 'DEMO006', 'DEMO007',
  'DEMO008', 'DEMO010', 'DEMO012',
  'DEMO016', 'DEMO019', 'DEMO020',
  'DEMO021', 'DEMO022', 'DEMO027',
  'DEMO028', 'DEMO031', 'DEMO032',
  'DEMO033', 'DEMO040', 'DEMO041',
  'DEMO045', 'DEMO048'
]
Fever Patients (temp >= 99.6°F): 9 [
  'DEMO005', 'DEMO008',
  'DEMO009', 'DEMO012',
  'DEMO021', 'DEMO023',
  'DEMO037', 'DEMO038',
  'DEMO047'
]
Data Quality Issues: 8 [
  'DEMO004', 'DEMO005',
  'DEMO007', 'DEMO023',
  'DEMO024', 'DEMO035',
  'DEMO036', 'DEMO043'
]

=== Submitting Results ===

=== Submission Response ===
{
  "success": true,
  "message": "Assessment submitted successfully",
  "requestId": "iad1::2qg9s-1774795079986-fb727c79f3ab",
  "results": {
    "score": 100,
    "percentage": 100,
    "status": "PASS",
    "breakdown": {
      "high_risk": {
        "score": 50,
        "max": 50,
        "correct": 20,
        "submitted": 20,
        "matches": 20
      },
      "fever": {
        "score": 25,
        "max": 25,
        "correct": 9,
        "submitted": 9,
        "matches": 9
      },
      "data_quality": {
        "score": 25,
        "max": 25,
        "correct": 8,
        "submitted": 8,
        "matches": 8
      }
    },
    "feedback": {
      "strengths": [
        " High-risk patients: Perfect score (20/20)",
        " Fever patients: Perfect score (9/9)",
        " Data quality issues: Perfect score (8/8)"
      ],
      "issues": []
    },
    "attempt_number": 1,
    "max_attempts": 3,
    "remaining_attempts": 2,
    "is_personal_best": true,
    "best_score": 100,
    "best_attempt_number": 1,
    "can_resubmit": true,
    "processed_in_ms": 203
  }
}
