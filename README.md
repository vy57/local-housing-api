# local-housing-api

Node.js API for checking housing affordability with live data from FRED and the US Census.

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root with these values:

```bash
FRED_API_KEY=your_fred_api_key
CENSUS_API_KEY=your_census_api_key
PORT=3000
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

## Run

Start the server with:

```bash
npm start
```

The API listens on the port from `PORT`, or `3000` if it is not set.

## Security and performance defaults

This API now includes:

- `helmet` for HTTP security headers
- strict CORS allowlist via `CORS_ORIGINS`
- `express-rate-limit` (100 requests / 15 minutes per IP) on `/api/*`
- `compression` middleware for compressed HTTP responses
- `GET /healthz` endpoint for uptime checks

## API

### `GET /healthz`

Simple health check endpoint returning service status, timestamp, and uptime.

### `GET /api/affordability`

Query parameter:

```text
zipCode=06830
```

Example request:

```bash
curl "http://localhost:3000/api/affordability?zipCode=06830"
```

The response includes:

- median income and median gross rent from the Census API
- live mortgage rate from FRED, with a fallback if the request fails
- estimated monthly mortgage payment
- property tax, PMI, and homeowners insurance
- total monthly housing cost
- affordability score and rent-to-income ratio

## Batch data fetch

The file `batchDataFetch.js` exports a `fetchRegionalData(zipCodesArray)` helper for fetching Census data for multiple ZIP codes with isolated failures.

Example:

```js
const fetchRegionalData = require('./batchDataFetch');

fetchRegionalData(['06830', '06840'])
	.then(console.log)
	.catch(console.error);
```

## Notes

- ZIP codes must be five digits.
- If the live API calls fail, the server falls back to local default values.
