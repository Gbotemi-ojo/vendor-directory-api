# AI Security Vendor Directory — Backend API

A production-ready backend service built for the AI Security Vendor Directory assignment. It provides a RESTful API with automated web scraping using headless browsers, asynchronous background job processing, relational database persistence, integration tests, and a scalable, decoupled architecture.

## 1. How to Run the Application

### Prerequisites

- Node.js v18 or higher
- Docker and Docker Compose
- npm
- Git

### Setup Instructions

#### Step 1: Clone the Repository

```bash
git clone https://github.com/Gbotemi-ojo/vendor-directory-api.git
cd vendor-directory-api
```

#### Step 2: Install Dependencies

```bash
npm install
```

#### Step 3: Configure Environment Variables

Create a `.env` file in the project root directory:

```env
PORT=5000

# MySQL Database
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=vendor_directory
DB_PORT=3306

# Redis
REDIS_URL=redis://127.0.0.1:6379
```

Replace `your_password` with the password configured for your local MySQL instance.

#### Step 4: Start the Local Infrastructure

Start the MySQL and Redis containers using Docker Compose:

```bash
docker-compose up -d
```

#### Step 5: Apply Database Schema and Seed Initial Data

Push the Drizzle ORM schema to the database and populate it with initial vendor data:

```bash
npx drizzle-kit push
npm run seed
```

#### Step 6: Start the Application

The application separates the HTTP API server from the background scraping worker. Run both processes in separate terminal windows.

**Terminal 1 — API Server**

```bash
npm run dev
```

**Terminal 2 — Background Worker**

```bash
npm run worker:dev
```

#### Step 7: Run Tests

Execute the automated test suite:

```bash
npm test
```

If the project includes a production build script, you can also verify compilation with:

```bash
npm run build
```

## 2. Tech Stack and Rationale

- **Node.js and Express.js:** Provide a lightweight, flexible foundation for the REST API. The application follows a layered architecture (Routes → Controllers → Services) to maintain a clear separation of concerns.
- **Docker and Docker Compose:** Provide a consistent local development environment for MySQL and Redis, making infrastructure setup reproducible across machines.
- **MySQL and Drizzle ORM:** MySQL provides relational data persistence, while Drizzle offers type-safe database queries with minimal abstraction and explicit SQL-oriented operations.
- **BullMQ and Redis:** Handle asynchronous background job processing. Resource-intensive scraping tasks are moved out of the HTTP request cycle into a dedicated worker, helping the API remain responsive.
- **Puppeteer and Stealth Plugin:** Enable browser-based scraping of JavaScript-rendered pages. The stealth plugin helps reduce some forms of automated-browser detection, although it does not guarantee bypassing anti-bot protections.
- **Zod:** Provides runtime schema validation for incoming requests and scraped data, helping prevent invalid data from reaching the database.
- **Vitest and Supertest:** Support automated testing. Vitest runs the test suite, while Supertest tests HTTP endpoints. Redis and BullMQ are mocked where appropriate to isolate API behavior.

## 3. What Was Built and What Was Left Out

### Implemented Features

- **Automated Scraping and Seeding:** Extracts vendor information using a headless browser and populates the database with vendor records.
- **Asynchronous Background Processing:** Queues scraping jobs through BullMQ and processes them using a dedicated worker.
- **RESTful CRUD and Search API:** Supports vendor retrieval, searching, and updates.
- **Server-Side Pagination:** Supports pagination through `page` and `limit` query parameters.
- **Redis-Backed Rate Limiting:** Protects the resource-intensive vendor refresh endpoint from excessive requests.
- **Automated Integration Tests:** Covers core API functionality, including health checks, filtering, updates, database retrieval, and rate-limit enforcement.

### Features Not Implemented

- **Authentication and Role-Based Access Control (RBAC):** Authentication was excluded to focus on the core vendor directory functionality. The API does not provide authenticated access control in its current implementation.
- **API Response Caching:** Redis is used for background queues and rate limiting, but vendor response caching was not implemented. The current approach relies on MySQL for data retrieval.

## 4. Key Architectural Decision and Trade-Off

### Decision: Decoupled API and Background Worker

The application separates the Express API from the Puppeteer scraping worker using Redis and BullMQ rather than performing browser-based scraping synchronously within HTTP requests.

### Alternative Considered

Performing scraping directly within the HTTP request lifecycle, using lightweight HTML parsing with Cheerio or running browser-based scraping inside the API service.

### Why This Approach Was Chosen

Headless browser scraping introduces significant execution time, memory usage, and resource overhead. Running these operations directly within an HTTP request can increase response times and cause requests to fail under resource constraints.

By delegating scraping to a BullMQ worker:

- The API can acknowledge refresh requests without waiting for the entire scraping operation to finish.
- Background processing reduces the impact of scraping workloads on API responsiveness.
- Failed jobs can be retried according to the queue's configured retry policy.
- Scraping concurrency can be controlled independently of incoming API traffic.
- The API and worker can be scaled separately.

The refresh endpoint can return HTTP `202 Accepted` when a job has been accepted for asynchronous processing.

The trade-off is additional infrastructure complexity. The application requires a Redis instance and a separate worker process or service. Deployments must also ensure that the worker remains available to process queued jobs.

## 5. Verification Strategy

The application was verified through automated tests and manual integration checks.

### Automated Integration Tests

Run the test suite using:

```bash
npm test
```

Vitest and Supertest, together with mocks for Redis and BullMQ where appropriate, are used to test core API behavior, including:

- Health-check responses
- Vendor retrieval and filtering
- Server-side pagination
- Vendor updates
- Input validation
- Rate-limit enforcement, including HTTP `429 Too Many Requests`

### Manual End-to-End Testing

The API was tested manually using Postman and integrated with the React frontend to check:

- API responses and database-backed vendor retrieval
- Search and pagination behavior
- Inline vendor editing
- Form validation
- Asynchronous refresh requests and background job processing

These checks help verify that the API, database, queue, worker, and frontend operate together as intended.

## 6. Known Limitations and Future Improvements

### Known Limitations

Puppeteer is resource-intensive, particularly when processing JavaScript-heavy websites. Even with worker concurrency limited to one, scaling scraping operations to thousands of vendors would require careful resource management, additional worker capacity, and potentially higher hosting costs.

Other limitations include the absence of authentication, API response caching, and automated proxy rotation.

### Future Improvements

Potential improvements include:

- **Automated Proxy Rotation:** Introduce compliant proxy management where permitted by target websites to improve resilience against IP-based rate limits.
- **LLM-Assisted Data Extraction:** Use language models as a fallback when website structures change and conventional DOM selectors become unreliable.
- **Redis Response Caching:** Cache frequently requested vendor data to reduce repeated database queries.
- **Improved Observability:** Add structured logging, job metrics, queue monitoring, and error reporting.
- **Worker Scaling:** Support multiple workers with configurable concurrency and resource limits.
- **Authentication and Authorization:** Add access control for administrative operations, including vendor updates and refresh requests.
- **More Comprehensive Tests:** Expand coverage for worker failures, retries, malformed scraped data, and database errors.

## 7. AI Assistance and Code Validation

### Where AI Was Used

AI tools assisted with:

- Scaffolding architectural patterns and BullMQ worker setup.
- Troubleshooting TypeScript and ESM module resolution.
- Improving Vitest mocks and test configuration.
- Structuring Drizzle ORM pagination logic using limit and offset.
- Improving code organization and documentation.

### Verification Process

AI-generated suggestions were treated as development assistance rather than a substitute for testing and review.

The implementation was reviewed and validated through the following checks:

1. **Build Validation:** Run `npm run build` to check compilation, provided the script is configured in `package.json`.
2. **Automated Testing:** Run `npm test` to execute the available test suite.
3. **Manual API Validation:** Test endpoints against local MySQL and Redis instances.
4. **Frontend Integration:** Connect the React frontend to verify searching, editing, pagination, and asynchronous refresh workflows.

Code changes were reviewed against the application's actual implementation and runtime behavior before being incorporated.

---

## License

No license has been specified for this project. Add a `LICENSE` file if you intend to distribute the repository under an open-source license.