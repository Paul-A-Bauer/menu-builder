---
applyTo: "**/*.{cs,js,jsx}"
---

# API-First Behavior

Keep essential product behavior authoritative in the .NET API. Put domain defaults, identifier generation, validation, and state-changing operations in backend services and expose them through explicit API endpoints.

Keep React focused on presenting API data, capturing user input, and rendering layout. The UI may hold transient editing state and perform presentation-only work such as responsive layout, print/export, and image preprocessing, but it must not duplicate domain rules or generate identifiers for persisted entities.

When changing behavior, update the API contract and implementation first, then connect the UI to the API response. Cover API-owned behavior with focused tests or executable endpoint checks. Preserve user edits when invoking state-changing endpoints, and surface API failures in the UI instead of leaving stale or blank content.
