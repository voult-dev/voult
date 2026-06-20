# Query Safety Patterns - NoSQL Injection Prevention

## Overview

This document describes the query safety patterns implemented in Voult.dev to prevent NoSQL injection attacks. All database queries must go through `SafeQueryBuilder` or use the validation functions directly.

## SafeQueryBuilder Class

The `SafeQueryBuilder` class wraps Mongoose model methods with input validation to prevent injection attacks.

### Location
`middleware/queryValidation.js`

### Instantiation Pattern

```javascript
const { SafeQueryBuilder } = require('../middleware/queryValidation');
const EndUser = require('../models/endUser');

const userBuilder = new SafeQueryBuilder(EndUser);
```

### Supported Methods

| Method | Validation Applied |
|--------|------------------|
| `findById(id)` | ObjectId format validation |
| `findOne(query)` | Query validation |
| `find(query, options)` | Query + options validation |
| `countDocuments(query)` | Query validation |
| `updateOne(filter, update)` | Query + update validation |
| `updateMany(filter, update)` | Query + update validation |
| `deleteOne(filter)` | Query validation |
| `deleteMany(filter)` | Query validation |
| `findOneAndUpdate(filter, update)` | Query + update validation |
| `findByIdAndUpdate(id, update)` | ObjectId + update validation |
| `findByIdAndDelete(id)` | ObjectId validation |

## Allowed Operators

### Query Operators (whitelisted)
- `$eq` - Equality match
- `$gt`, `$gte` - Greater than / greater than or equal
- `$lt`, `$lte` - Less than / less than or equal
- `$in`, `$nin` - In / not in array (max 100 items)
- `$exists` - Field existence check (boolean only)
- `$ne` - Not equal
- `$not` - Negation (validated recursively)

### Update Operators (whitelisted)
- `$set` - Set field values
- `$inc` - Increment numeric field (must be number)
- `$push`, `$addToSet` - Array modification
- `$pull`, `$pullAll` - Array removal
- `$unset` - Remove field
- `$setOnInsert` - Set on insert only

## Usage Examples

### ✅ Correct Usage - SafeQueryBuilder

```javascript
// In controller or middleware
const { SafeQueryBuilder } = require('../middleware/queryValidation');

const userBuilder = new SafeQueryBuilder(EndUser);

// Find by ID (safe)
const user = await userBuilder.findById(userId);

// Find one with query (validated)
const user = await userBuilder.findOne({
  email: normalizedEmail,
  deletedAt: { $exists: false }
});

// Find with options (limit/skip protected)
const users = await userBuilder.find(
  { app: appId },
  { limit: 100, skip: 0 }
);

// Update (both filter and update validated)
await userBuilder.updateOne(
  { _id: userId },
  { $set: { email: newEmail } }
);

// Delete (filter validated)
await userBuilder.deleteOne({ _id: userId });
```

### ❌ Incorrect Usage - Raw Model Access

```javascript
// DO NOT USE - Vulnerable to injection
const user = await EndUser.findOne({ $where: 'this.isAdmin' });
const users = await User.find(req.query); // User input directly in query!
const result = await App.updateOne(filter, { $set: updateData }); // Unvalidated
```

### Using Validation Functions Directly

When working directly with Mongoose models (e.g., in static model methods):

```javascript
const { validateMongoQuery, validateMongoUpdate } = require('../middleware/queryValidation');

// In a model static method
static async claimValidToken(rawToken) {
  const tokenHash = this.hashToken(rawToken);
  const now = new Date();
  
  const filter = {
    tokenHash,
    used: false,
    expiresAt: { $gt: now }
  };
  const update = {
    $set: { used: true, usedAt: now }
  };
  
  validateMongoQuery(filter);
  validateMongoUpdate(update);
  
  return this.findOneAndUpdate(filter, update, { new: true });
}
```

## Injection Attack Prevention

### Blocked Patterns

The following injection patterns are blocked:

1. **JavaScript Code Injection (`$where`)**
   ```javascript
   // BLOCKED
   { $where: 'this.password == "admin"' }
   { password: { $where: function() { return true; } } }
   ```

2. **Regular Expression Injection (`$regex`)**
   ```javascript
   // BLOCKED
   { username: { $regex: '.*' } }
   { email: { $regex: 'admin', $options: 'i' } }
   ```

3. **Logical Operator Injection (`$or`, `$and`, `$nor`)**
   ```javascript
   // BLOCKED - These are not in the whitelist
   { $or: [{ email: 'admin' }, { username: 'admin' }] }
   { $and: [{ x: 1 }, { y: 2 }] }
   ```

4. **Function Injection**
   ```javascript
   // BLOCKED
   { callback: () => {} }
   { filter: 'function() { return true; }' }
   ```

5. **Prototype Pollution**
   ```javascript
   // BLOCKED
   { __proto__: { isAdmin: true } }
   { nested: { $gt: 1 } } // Nested operator without whitelist
   ```

6. **Array Injection**
   ```javascript
   // BLOCKED
   { status: ['active', 'pending'] } // Arrays in field values are blocked
   ```

### Common Pitfalls to Avoid

1. **Never use user input directly in queries**
   ```javascript
   // WRONG
   User.findOne(req.body); // Attacker can inject $where, $or, etc.
   
   // CORRECT
   User.findOne({
     email: sanitize(req.body.email)
   });
   ```

2. **Always validate dynamic field names**
   ```javascript
   // WRONG
   const sortField = req.query.sort;
   User.find({}).sort({ [sortField]: 1 }); // Can inject operators
   
   // CORRECT
   const allowedSorts = ['email', 'createdAt', 'username'];
   if (!allowedSorts.includes(sortField)) {
     throw new Error('Invalid sort field');
   }
   ```

3. **Use SafeQueryBuilder for all data access**
   ```javascript
   // Add to every controller that accesses the database
   const { SafeQueryBuilder } = require('../middleware/queryValidation');
   const userBuilder = new SafeQueryBuilder(EndUser);
   ```

## Integration Checklist

- [ ] All controllers use `SafeQueryBuilder` for database queries
- [ ] All middleware that accesses the database uses `SafeQueryBuilder`
- [ ] All service files use `SafeQueryBuilder` for queries
- [ ] Model static methods call `validateMongoQuery`/`validateMongoUpdate` before operations
- [ ] Scripts maintenance files use `SafeQueryBuilder`
- [ ] Tests cover injection attack scenarios

## Testing

Tests are located in `tests/queryValidation.test.js` and cover:
- Valid query patterns (positive cases)
- Injection attack patterns (negative cases)
- Edge cases (empty arrays, invalid types, etc.)