# App Creation CSRF Invalid Token Bug

## Reported Problem

Submitting the form on `http://localhost:3000/app/new` sends a `POST /app` request and fails with:

```text
[WEB ERROR HANDLER] Error on /app :
[WEB ERROR HANDLER] Message: invalid csrf token
[WEB ERROR HANDLER] Error code: EBADCSRFTOKEN
POST /app 403
```

The `GET /app/new` request succeeds and renders the page, but the form submission is rejected by CSRF validation.

## Request Flow

The relevant flow is:

1. `GET /app/new`
   - Rendered by `controllers/web/app.js:7-9`.
   - The page includes a hidden CSRF input in `views/app/new.ejs:12-13`.
   - `src/index.js:129` applies global CSRF middleware before routes are mounted.
   - `src/index.js:137-139` generates `res.locals.csrfToken` with `req.csrfToken()` for web routes.

2. `POST /app`
   - Form posts to `/app` with `method="POST"` in `views/app/new.ejs:12`.
   - The form includes `<input type="hidden" name="_csrf" value="<%=csrfToken %>">` in `views/app/new.ejs:13`.
   - The request enters the global CSRF middleware at `src/index.js:129`.
   - It then enters the app route at `routes/web/app.js:17`.
   - The route stack for `POST /app` is:
     - `validate(appSchemas.createAppSchema)`
     - `csrfProtection`
     - `controller.newApp`

The stack trace confirms this order:

```text
at csrf (.../node_modules/csurf/index.js:112:19)
at Layer.handleRequest (.../router/lib/layer.js:152:17)
at next (.../router/lib/route.js:157:13)
at /.../validators/validate.js:28:5
at Layer.handleRequest (.../router/lib/layer.js:152:17)
at next (.../router/lib/route.js:157:13)
```

The first `csrf` in the stack is the global CSRF middleware. After validation calls `next()` at `validators/validate.js:28`, the second `csrf` is the route-level CSRF middleware on `routes/web/app.js:17`.

## Root Cause

The bug is caused by CSRF protection being applied twice to `POST /app`, with a body-stripping validator between the two CSRF checks.

### 1. Global CSRF middleware is already active

`src/index.js:129` applies CSRF protection globally:

```javascript
app.use(csrfProtection);
```

This middleware validates state-changing requests before any route-specific middleware runs.

### 2. The app creation route also applies CSRF protection

`routes/web/app.js:17` applies CSRF protection again, after validation:

```javascript
router.post('/', validate(appSchemas.createAppSchema), csrfProtection, catchAsync(controller.newApp));
```

So `POST /app` runs CSRF validation twice.

### 3. The validator removes the CSRF token before the second CSRF check

The validator uses Joi with `stripUnknown: true` in `validators/validate.js:8-11`:

```javascript
schema.validate(req[property], {
  abortEarly: false,
  stripUnknown: true
});
```

The `createAppSchema` in `validators/web/app.js:3-7` only allows:

- `name`
- `description`
- `callbackUrl`

It does not allow `_csrf`. Because `stripUnknown` is enabled, Joi removes `_csrf` from `req.body` after the first CSRF validation passes.

Then the route-level `csrfProtection` runs. `csurf` looks for the token in `req.body._csrf`, `req.query._csrf`, or CSRF headers, as shown in `node_modules/csurf/index.js:130-135`. At that point, `req.body._csrf` has been stripped, so the second CSRF validation fails with `EBADCSRFTOKEN`.

## Why The Form Is Not the Main Problem

The form does include the CSRF token:

```ejs
<input type="hidden" name="_csrf" value="<%=csrfToken %>">
```

`views/app/new.ejs:13`

The token is generated for web routes by `src/index.js:137-139`:

```javascript
res.locals.csrfToken = req.csrfToken();
```

The failure happens after the submitted token has already passed the first CSRF check. The second CSRF check fails because the validator removed the token before it ran.

## Recommended Fix

Remove the duplicate route-level CSRF middleware from web routes because `src/index.js:129` already applies CSRF protection globally.

For app creation, change `routes/web/app.js:17` from:

```javascript
router.post('/', validate(appSchemas.createAppSchema), csrfProtection, catchAsync(controller.newApp));
```

to:

```javascript
router.post('/', validate(appSchemas.createAppSchema), catchAsync(controller.newApp));
```

Then remove the unused import if no other route in that file uses it:

```javascript
const { csrfProtection } = require('../../middleware/csrfProtection');
```

This is the safest and simplest fix for this codebase because CSRF is intentionally centralized in `src/index.js`.

## Alternative Fixes

If the team wants route-level CSRF middleware instead of global middleware, remove the global `app.use(csrfProtection)` from `src/index.js:129` and ensure every state-changing web and API route has its own CSRF middleware. This is riskier because missing route-level CSRF protection would be easy to introduce.

Another option is to move route-level `csrfProtection` before validation:

```javascript
router.post('/', csrfProtection, validate(appSchemas.createAppSchema), catchAsync(controller.newApp));
```

This would avoid the specific `POST /app` failure because the second CSRF check would run before Joi strips `_csrf`. However, it would still leave duplicate CSRF validation in the route stack and does not fix the broader design issue.

A third option is to preserve `_csrf` during validation by adding it to the schema or disabling `stripUnknown`, but that weakens request sanitization and is not recommended.

## Why Removing Route-Level CSRF Fixes It

With only the global CSRF middleware:

1. `express.urlencoded` parses the form body.
2. Global `csrfProtection` validates `_csrf` from `req.body`.
3. Joi validation strips unknown fields, including `_csrf`.
4. The controller receives the sanitized app fields.
5. No second CSRF middleware runs after `_csrf` has been removed.

This keeps CSRF protection active while allowing the validator to remove unknown fields safely.

## Files Involved

| File | Role |
| --- | --- |
| `src/index.js:129` | Global CSRF middleware that already protects `POST /app`. |
| `src/index.js:137-139` | Generates `csrfToken` for rendered web forms. |
| `routes/web/app.js:17` | Duplicate route-level CSRF middleware causing the second failed validation. |
| `validators/validate.js:8-11` | Joi validation with `stripUnknown: true`, which removes `_csrf`. |
| `validators/validate.js:28` | Calls `next()` after validation, allowing the duplicate CSRF middleware to run. |
| `validators/web/app.js:3-7` | App schema does not allow `_csrf`, so it is stripped. |
| `views/app/new.ejs:12-13` | Form and hidden CSRF token field. |
| `node_modules/csurf/index.js:130-135` | `csurf` token lookup from body, query, or headers. |

## Summary

The invalid CSRF token on app creation is not caused by a missing token in the form. It is caused by duplicate CSRF validation on `POST /app`. The global CSRF middleware validates the token first, then Joi strips the `_csrf` field, and then the route-level CSRF middleware validates again and fails because the token is no longer present.

Remove the route-level `csrfProtection` from `routes/web/app.js:17` and rely on the global CSRF middleware in `src/index.js:129`.
