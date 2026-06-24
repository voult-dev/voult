# Audit Logging API Reference

This document provides detailed information about the audit logging API endpoints available in the Voult application.

## Base URL

All API endpoints are prefixed with `/api/app` and require application authentication via the `appClient` middleware.

## Authentication

Most audit log endpoints require application authentication. The `/my` endpoint additionally requires user authentication.

## Endpoints

### Get Application Audit Logs

```
GET /api/app/logs
```

Retrieve audit logs for the application with filtering and pagination capabilities.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | String (ObjectId) | Filter logs by user ID |
| action | String | Filter by action type (see [Audit Actions](#audit-actions)) |
| status | String | Filter by status: `SUCCESS`, `FAILURE`, or `PENDING` |
| riskLevel | String | Filter by risk level: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| ipAddress | String | Filter by IP address |
| startDate | String (ISO Date) | Start of date range (inclusive) |
| endDate | String (ISO Date) | End of date range (inclusive) |
| limit | Number | Maximum number of results to return (default: 50, max: 200) |
| skip | Number | Number of results to skip for pagination |
| minRiskLevel | String | Minimum risk level to include (defaults to `LOW`) |

#### Response Format

```json
{
  "logs": [
    {
      "_id": "ObjectId",
      "action": "String",
      "userId": "ObjectId or null",
      "appId": "ObjectId",
      "ipAddress": "String",
      "userAgent": "String",
      "details": "Object",
      "status": "String",
      "riskLevel": "String",
      "geolocation": {
        "country": "String",
        "region": "String",
        "city": "String",
        "latitude": "Number",
        "longitude": "Number"
      },
      "timestamp": "ISO Date String"
    }
  ],
  "total": Number,
  "limit": Number,
  "skip": Number
}
```

#### Example Request

```
GET /api/app/logs?action=LOGIN_FAILURE&status=FAILURE&limit=25
```

#### Example Response

```json
{
  "logs": [
    {
      "_id": "60f7b1b9e4b0a8c3d4e5f6a7",
      "action": "LOGIN_FAILURE",
      "userId": "60f7b1b9e4b0a8c3d4e5f6a8",
      "appId": "60f7b1b9e4b0a8c3d4e5f6a9",
      "ipAddress": "203.0.113.1",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "details": {
        "attemptCount": 3,
        "username": "user@example.com"
      },
      "status": "FAILURE",
      "riskLevel": "MEDIUM",
      "geolocation": {
        "country": "US",
        "region": "California",
        "city": "San Francisco",
        "latitude": 37.7749,
        "longitude": -122.4194
      },
      "timestamp": "2023-06-15T14:30:00.000Z"
    }
  ],
  "total": 42,
  "limit": 25,
  "skip": 0
}
```

### Get Security Summary

```
GET /api/app/logs/summary
```

Get statistical summary of audit events for the application.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | String (ISO Date) | Start of date range (defaults to 24 hours ago) |
| endDate | String (ISO Date) | End of date range (defaults to now) |

#### Response Format

```json
{
  "period": {
    "start": "ISO Date String",
    "end": "ISO Date String"
  },
  "totalEvents": Number,
  "byAction": [
    {
      "action": "String",
      "count": Number
    }
  ],
  "byRiskLevel": [
    {
      "riskLevel": "String",
      "count": Number
    }
  ],
  "byStatus": [
    {
      "status": "String",
      "count": Number
    }
  ],
  "recentHighRisk": [
    {
      "_id": "ObjectId",
      "action": "String",
      "userId": "ObjectId or null",
      "ipAddress": "String",
      "riskLevel": "String",
      "timestamp": "ISO Date String",
      "details": "Object"
    }
  ]
}
```

#### Example Response

```json
{
  "period": {
    "start": "2023-06-14T14:30:00.000Z",
    "end": "2023-06-15T14:30:00.000Z"
  },
  "totalEvents": 1245,
  "byAction": [
    {
      "action": "LOGIN_SUCCESS",
      "count": 450
    },
    {
      "action": "PAGE_VIEW",
      "count": 320
    },
    {
      "action": "LOGIN_FAILURE",
      "count": 85
    }
  ],
  "byRiskLevel": [
    {
      "riskLevel": "LOW",
      "count": 1100
    },
    {
      "riskLevel": "MEDIUM",
      "count": 120
    },
    {
      "riskLevel": "HIGH",
      "count": 20
    },
    {
      "riskLevel": "CRITICAL",
      "count": 5
    }
  ],
  "byStatus": [
    {
      "status": "SUCCESS",
      "count": 1050
    },
    {
      "status": "FAILURE",
      "count": 180
    },
    {
      "status": "PENDING",
      "count": 15
    }
  ],
  "recentHighRisk": [
    {
      "_id": "60f7b1b9e4b0a8c3d4e5f6aa",
      "action": "LOGIN_FAILURE",
      "userId": null,
      "ipAddress": "203.0.113.1",
      "riskLevel": "HIGH",
      "timestamp": "2023-06-15T14:25:00.000Z",
      "details": {
        "attemptCount": 10,
        "username": "admin@example.com"
      }
    }
  ]
}
```

### Get High-Risk Events

```
GET /api/app/logs/high-risk
```

Get audit events with HIGH or CRITICAL risk levels.

#### Query Parameters

Same as `/api/app/logs` plus:

| Parameter | Type | Description |
|-----------|------|-------------|
| minRiskLevel | String | Minimum risk level to include (`HIGH` or `CRITICAL`, default: `HIGH`) |

#### Response Format

Same as `/api/app/logs`

### Get User's Audit Trail

```
GET /api/app/logs/my
```

Get audit trail for the currently authenticated user.

#### Requirements

- User must be authenticated (valid JWT or session)

#### Query Parameters

Same as `/api/app/logs`

#### Response Format

Same as `/api/app/logs`

### Get Retention Policy

```
GET /api/app/logs/retention
```

Get the current audit log retention policy configuration.

#### Response Format

```json
{
  "retentionDays": Number,
  "cutoffDate": "ISO Date String",
  "geolocationEnabled": Boolean,
  "retentionEnabled": Boolean
}
```

#### Example Response

```json
{
  "retentionDays": 90,
  "cutoffDate": "2023-03-18T14:30:00.000Z",
  "geolocationEnabled": true,
  "retentionEnabled": true
}
```

## Error Responses

All endpoints return standard HTTP status codes:

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthenticated (missing or invalid authentication) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

Error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  }
}
```

## Filtering Examples

### Get all failed login attempts in the last 7 days

```
GET /api/app/logs?action=LOGIN_FAILURE&status=FAILURE&startDate=2023-06-08T00:00:00.000Z&limit=100
```

### Get all critical risk events

```
GET /api/app/logs?minRiskLevel=CRITICAL
```

### Get activity for a specific user

```
GET /api/app/logs?userId=60f7b1b9e4b0a8c3d4e5f6a8&limit=50
```

### Get all activity from a suspicious IP

```
GET /api/app/logs?ipAddress=203.0.113.1&limit=100
```

### Get paginated results

```
GET /api/app/logs?limit=25&skip=50  // Gets items 51-75
```

## Rate Limiting

Audit log endpoints are subject to rate limiting to prevent abuse. Refer to the main API documentation for specific rate limits.

## Data Retention

Audit logs are automatically deleted based on the retention policy configured via environment variables. The default retention period is 90 days.

To check current retention settings, use the `/api/app/logs/retention` endpoint.

## Related Services

The audit logging system works in conjunction with:

1. **Risk Assessment Service** (`services/riskAssessmentService.js`) - Evaluates risk levels for actions
2. **Geolocation Service** (`services/geolocationService.js`) - Resolves IP addresses to geographic locations
3. **Audit Retention Service** (`services/auditRetentionService.js`) - Automatically removes old logs

## Implementation Notes

### Performance Considerations

- All queryable fields are indexed in MongoDB for efficient retrieval
- Geolocation lookups are cached to minimize external API calls
- Write operations are fire-and-forget; errors are logged but don't block the main operation
- Read operations use pagination to prevent overwhelming responses

### Security Considerations

- Audit logs are immutable and append-only
- Failed audit logging attempts don't affect the primary operation
- Sensitive information (passwords, tokens, etc.) should never be stored in the `details` field
- Access to audit logs should be restricted to authorized personnel only

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2023-06-01 | Initial release |