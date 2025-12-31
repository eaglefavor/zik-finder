# Student Request Function Upgrades (AUDITED)

This document tracks planned and implemented improvements for the "Lodge Request" system.

## 1. The "Landlord Interest" Loop (DONE)
- **Feature**: Add an **"I have a match"** button for landlords on every student request in the Market.
- **Trigger**: Landlord clicks the button and selects their lodge.
- **Action**: Student receives a notification: *"Landlord [Name] has a lodge that matches your request! [Link to Lodge]"*.
- **Value**: Incentivizes landlords to proactively reach out to qualified leads.

## 2. Request Expiry & Auto-Cleanup (DONE)
- **Feature**: Automatic unpublishing of requests after a set duration (14 days).
- **Trigger**: `expires_at` column in database.
- **Action**: Request is hidden from market view once current date exceeds `expires_at`.
- **Value**: Keeps the Market fresh and reduces calls to students who have already moved.

## 3. "Smart Match" Scoring (DONE)
- **Feature**: Introduction of detailed match scoring based on location and budget.
- **Action**: Display a compatibility percentage to landlords (e.g., *"90% Match"*).
- **Value**: Helps landlords prioritize which students to contact first based on lodge compatibility.

## 4. Student Request Analytics (TODO)
- **Feature**: A "My Requests" dashboard for students.
- **Metrics**: Show "View Count" (how many landlords saw the request) and "Lead Count" (how many landlords clicked the phone number).
- **Value**: Provides feedback to students on their request performance.

## 5. Multi-Location & Budget Ranges (DONE)
- **Feature**: Allow students to select multiple areas and set a budget range (Min to Max).
- **Value**: Reflects actual student behavior and increases the matching pool for landlords.

## 6. "Found a Lodge" (Fulfilled Status) (DONE)
- **Feature**: A simple "Found it" button for students on their own requests.
- **Action**: Immediately remove the request from the marketplace.
- **Value**: Protects student privacy and prevents unnecessary calls once they are settled.
