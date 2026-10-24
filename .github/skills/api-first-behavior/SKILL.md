---
name: api-first-behavior
description: "Use when adding or changing product behavior in this repository, especially menu defaults, identifiers, validation, mutations, persistence, or API/UI responsibilities."
---

# API-First Behavior

Use this workflow when a change affects what the product does or what data it accepts, creates, or mutates.

1. Identify the domain decision and make the API authoritative for it. Keep defaults, persisted IDs, validation, and state transitions out of React components.
2. Implement the behavior behind a focused backend service and an explicit HTTP endpoint. Return the updated resource or a clear status so clients can render authoritative state.
3. Keep React as a presentation and input layer. It may manage temporary form state and presentation tasks such as layout, print/export, and image preprocessing, but it should not recreate backend rules.
4. Connect the UI to the endpoint, preserve pending user edits before mutations, and replace local state with the API response.
5. Validate the API and UI integration with a focused test or endpoint check, including relevant not-found or invalid-input behavior.

For this project, menu creation and item add/remove are API operations. Section layout and CSS classes are presentation concerns. Generate persisted menu and item IDs on the server.
