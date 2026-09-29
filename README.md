# AI Security Vendor Directory - Backend API

A production-ready, full-stack backend service built for the **AI Security Vendor Directory** assignment.

It provides a clean RESTful API with automated web scraping, relational database persistence, integration tests, and serverless deployment configuration.

---

## 1. How to Run the Application

### Prerequisites

- Node.js (v18 or higher) installed locally.
- Access to a MySQL instance or PlanetScale database.

### Setup Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/Gbotemi-ojo/vendor-directory-api.git
cd vendor-directory-api
````

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=vendor_directory
DB_PORT=3306
```

> **Note:** Never commit your `.env` file or database credentials to version control.

#### 4. Run Migrations and Seed Initial Data

Push the database schema:

```bash
npx drizzle-kit push
```

Seed the initial vendor data:

```bash
npm run seed
```

#### 5. Run the Application

**Development mode:**

```bash
npm run dev
```

**Production build:**

```bash
npm run build
npm start
```

**Run tests:**

```bash
npm test
```

---

## 2. Tech Stack and Why

### Node.js & Express.js

Chosen for its speed, lightweight footprint, and mature ecosystem.

The application follows a layered architecture consisting of:

```text
Routes → Controllers → Services
```

This enforces a clear separation of concerns and keeps business logic isolated from HTTP request handling.

### MySQL & Drizzle ORM

Drizzle provides a lightweight, type-safe SQL query builder without the heavier abstraction associated with traditional ORMs such as Prisma or TypeORM.

It maps cleanly to relational databases such as MySQL and PlanetScale while keeping database queries explicit and type-safe.

### Cheerio

Cheerio is used for fast, server-side HTML parsing to extract structured vendor information from target web sources without the overhead of full browser automation.

### Vitest & Supertest

* **Vitest** provides a fast and modern test runner.
* **Supertest** enables HTTP integration testing against the actual Express API.

Together, they provide fast feedback while verifying real API behavior.

---

## 3. What Was Built vs. Left Out

### What Was Built

* **Live Scraping & Seeding Pipeline**

  * Automated extraction of vendor titles, descriptions, and source links.
* **RESTful CRUD & Search API**

  * Endpoints supporting vendor retrieval, filtering, and attribute updates.
* **Live Refresh Mechanism**

  * On-demand endpoint that re-scrapes the live source URL and updates vendor metadata dynamically.
  * `POST /api/vendors/:id/refresh`
* **Automated Integration Testing**

  * Test coverage for health checks, filtering, vendor updates, and database retrieval.

### What Was Left Out

#### User Authentication & Role-Based Access Control (RBAC)

The assignment focuses on the core functionality of the vendor directory, so the API uses public unauthenticated access.

#### Advanced Caching Layer (Redis)

Redis was omitted because the dataset size and expected workload for this assignment fit comfortably within the performance characteristics of the relational database.

---

## 4. Key Decision, Alternative Considered, and Trade-off

### Decision

The application uses native HTTP `fetch` combined with **Cheerio** for live refreshes and initial data seeding instead of a full headless browser.

### Alternative Considered

**Puppeteer / Playwright**

### Why This Approach Was Chosen

A headless browser introduces significantly more resource and execution overhead, which can be problematic in serverless environments such as Vercel.

For the target sources, direct HTTP requests combined with Cheerio are sufficient to parse standard HTML, metadata, and DOM elements.

This approach provides:

* Lower memory usage
* Faster execution
* Simpler deployment
* Fewer runtime dependencies
* Better compatibility with serverless execution limits

The trade-off is that it is less suitable for websites where important content is rendered entirely through client-side JavaScript.

---

## 5. Verification Strategy

The application was verified through a multi-tiered approach.

### 1. Automated Integration Tests

The test suite is executed using:

```bash
npm test
```

Vitest and Supertest are used to verify core API functionality, including:

* Health checks
* Vendor listing
* Vendor retrieval by ID
* Search and filtering
* Vendor updates
* Database-backed retrieval

### 2. Manual End-to-End Checks

API responses were also tested manually using `curl` and integrated with the React frontend client.

These checks were used to verify:

* Search behavior
* Search debouncing
* Inline editing
* Live vendor refresh
* API/frontend integration

---

## 6. Known Limitation and Future Improvements

### Known Limitation

The live refresh mechanism depends on the structure and markup of the target websites remaining relatively consistent.

If a target website significantly changes its HTML structure, existing selectors or fallback strategies may no longer extract all vendor metadata correctly.

### Future Improvement

A more resilient scraping pipeline could be introduced using:

* **BullMQ** for background job processing
* Automated proxy rotation
* Retry and backoff strategies
* Multiple extraction strategies
* LLM-assisted HTML extraction as a fallback for structurally changed pages

This would make the scraping pipeline more resilient to website layout changes while keeping the primary extraction path lightweight and deterministic.

---

## 7. AI Assistance & Code Validation

### Where AI Was Used

AI assistance was used to help:

* Scaffold boilerplate architectural patterns
* Optimize TypeScript ESM/CommonJS module resolution under `NodeNext`
* Structure regular expression matching for fallback metadata parsing
* Improve implementation and documentation structure

### How It Was Validated

AI-generated code was treated as implementation assistance rather than as a substitute for verification.

The implementation was validated through:

1. **TypeScript compilation**

   ```bash
   npm run build
   ```

2. **Automated test execution**

   ```bash
   npm test
   ```

3. **Manual API validation**

   API responses were manually tested against the local and staging environments.

4. **Frontend integration testing**

   The backend was connected to the React frontend to verify search, editing, and live refresh functionality end-to-end.

All generated snippets were reviewed and validated against the application's actual runtime behavior before being incorporated into the project.

```
```