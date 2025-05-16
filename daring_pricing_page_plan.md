# Development Plan: "Daring" Sommerkampagne Pricing Page

**Status:** Agreed upon with user on 2025-05-15.

## I. Core Page Structure & Styling (Initial Setup with Placeholders)
    A.  **New HTML File:** Create the main pricing page (e.g., `sommer-kampagne-preview-v1.html` - obscure name to be confirmed).
    B.  **Basic Structure:** Standard HTML (head, body).
    C.  **Styling:** Link to existing CSS to utilize current color schemes.
    D.  **Theme:** Implement the "almost completely black" theme.
    E.  **SEO Control:** Add `<meta name="robots" content="noindex">` to the `<head>`.
    F.  **Placeholder Content Sections:**
        1.  Campaign Title (e.g., "Sommerkampagne!")
        2.  Dynamic Counter Display (e.g., "Antal tilmeldte: [counter_value]")
        3.  Pricing Tier Information (e.g., "Tier 1 (0-500 tilmeldte): 600 DKK", "Tier 2 (501-1000 tilmeldte): 1200 DKK")
        4.  Product Selection/CTA: Placeholder buttons for "H3LLO", "H3LLO Bundle", "H3LLO StartKlar".
        5.  General descriptive text areas (using placeholder "lorem ipsum" style text).

## II. Dynamic Counter Functionality
    A.  **Frontend Display:**
        1.  Visually initialize the counter at "69".
        2.  Design how the counter and pricing tiers are displayed and update.
    B.  **Backend/Integration (Deferred - Awaiting Google Sheet Details):**
        1.  *Future Task:* Implement logic to fetch the actual signup count from the specified Google Sheet.
        2.  *Future Task:* Update the displayed counter and active pricing tier based on this fetched count.
        *(User to provide: Google Sheet ID, tab name, relevant column, and access method later).*

## III. Stripe Payment Integration
    A.  **Frontend Elements:**
        1.  Ensure "Buy" buttons are clear for each product: "H3LLO", "H3LLO Bundle", "H3LLO StartKlar".
    B.  **Backend/Integration (Deferred - Awaiting Stripe Details):**
        1.  *Future Task:* Implement logic to redirect users to the appropriate Stripe Checkout session when a "Buy" button is clicked.
        *(User to provide: Stripe Product IDs and Price IDs later).*
    C.  **Thank You Pages:**
        1.  Create three distinct placeholder HTML pages:
            *   `thank-you-h3llo.html`
            *   `thank-you-h3llo-bundle.html`
            *   `thank-you-h3llo-startklar.html`
        2.  These will be the success URLs configured in Stripe for each product.
        3.  Ensure these also have `<meta name="robots" content="noindex">`.
        *(User to provide: Details for any further post-purchase actions later).*

## IV. "Not Live" Strategy Implementation
    A.  **Obscure URL:** The main pricing page HTML file will have a non-guessable name.
    B.  **Noindex Meta Tags:** Confirm presence on the main pricing page and all thank you pages.
    C.  **Robots.txt Update:** Add `Disallow` directives in `robots.txt` for the pricing page and thank you page URLs. For example:
        ```
        User-agent: *
        Disallow: /sommer-kampagne-preview-v1.html 
        Disallow: /thank-you-h3llo.html
        Disallow: /thank-you-h3llo-bundle.html
        Disallow: /thank-you-h3llo-startklar.html
        ```
        *(Exact paths will depend on final file naming).*

## V. Content and "Daring" Design Iteration (Ongoing)
    A.  User will provide the final Danish text content to replace all placeholders.
    B.  User will provide further input on additional "daring" design elements (typography, layout, animations, etc.) for later incorporation.

## VI. Key Information Still Needed from User (To be provided when ready):
    A.  **Google Sheet Details:** Sheet ID, tab name, relevant column for signups, and preferred access method.
    B.  **Stripe Details:** Product IDs and Price IDs for "H3LLO", "H3LLO Bundle", "H3LLO StartKlar". Clarification on any post-purchase actions beyond displaying thank you pages.
    C.  **"Daring" Design:** Any further specific ideas for the page's unique aesthetic or UX.
    D.  **Text Content:** All final copy for the page.

## Visual Flow Diagram:

```mermaid
graph TD
    A[User accesses Obscure URL for Pricing Page] --> B{Pricing Page};
    B -- Displays --> BA[Dark Theme, "Daring" Styling];
    B -- Displays --> C[Campaign Info: "Sommerkampagne!"];
    B -- Displays --> D[Dynamic Counter (Visually starts 69, actual from GSheet)];
    B -- Displays --> E[Pricing Tiers (e.g., 0-500: 600 DKK, 501-1000: 1200 DKK)];
    B -- Displays --> F[Product Options: H3LLO, Bundle, StartKlar with "Buy" buttons];

    F -- User clicks "Buy H3LLO" --> G{Stripe Checkout: H3LLO};
    F -- User clicks "Buy H3LLO Bundle" --> H{Stripe Checkout: H3LLO Bundle};
    F -- User clicks "Buy H3LLO StartKlar" --> I{Stripe Checkout: H3LLO StartKlar};

    G -- Payment Success --> J[Thank You Page: H3LLO];
    H -- Payment Success --> K[Thank You Page: H3LLO Bundle];
    I -- Payment Success --> L[Thank You Page: H3LLO StartKlar];

    subgraph External Systems & Data
        M[(Google Sheet: Signup Count)]
        N[(Stripe: Products & Payment)]
    end

    D -.-> M;
    G -.-> N;
    H -.-> N;
    I -.-> N;