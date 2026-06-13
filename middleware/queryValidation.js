const mongoose = require('mongoose');

const ALLOWED_QUERY_OPERATORS = new Set([
  '$eq',
  '$gt',
  '$gte',
  '$in',
  '$lt',
  '$lte',
  '$ne',
  '$exists',
  '$nin',
  '$not'
]);

const LOGICAL_QUERY_OPERATORS = new Set(['$and', '$nor', '$or']);

const ALLOWED_UPDATE_OPERATORS = new Set([
  '$addToSet',
  '$inc',
  '$pull',
  '$pullAll',
  '$push',
  '$set',
  '$setOnInsert',
  '$unset'
]);

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';
const isScalar = (value) => (
  value === null ||
  value === undefined ||
  ['string', 'number', 'boolean'].includes(typeof value) ||
  value instanceof Date ||
  value instanceof mongoose.Types.ObjectId
);

const assertSafeQueryFieldValue = (value, path) => {
  if (Array.isArray(value)) {
    throw new Error(`Unsafe array query value at ${path}`);
  }

  if (isScalar(value)) {
    return;
  }

  if (value instanceof RegExp || typeof value === 'function' || Buffer.isBuffer(value)) {
    throw new Error(`Unsafe query value type at ${path}`);
  }

  if (!isPlainObject(value)) {
    throw new Error(`Unsafe query value type at ${path}`);
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (!key.startsWith('$')) {
      throw new Error(`Unsafe nested object query value at ${path}.${key}`);
    }

    if (!ALLOWED_QUERY_OPERATORS.has(key)) {
      throw new Error(`Unsafe query operator at ${path}.${key}`);
    }

    if (key === '$exists') {
      if (typeof nestedValue !== 'boolean') {
        throw new Error(`Unsafe $exists value at ${path}.${key}`);
      }
      continue;
    }

    if (key === '$in' || key === '$nin') {
      if (!Array.isArray(nestedValue) || nestedValue.length > 100) {
        throw new Error(`Unsafe ${key} value at ${path}.${key}`);
      }
      nestedValue.forEach((item, index) => assertSafeQueryFieldValue(item, `${path}.${key}[${index}]`));
      continue;
    }

    if (key === '$not') {
      assertSafeQueryObject(nestedValue, `${path}.${key}`);
      continue;
    }

    if (['$gt', '$gte', '$lt', '$lte'].includes(key)) {
      if (!isScalar(nestedValue)) {
        throw new Error(`Unsafe comparison value at ${path}.${key}`);
      }
      continue;
    }

    assertSafeQueryFieldValue(nestedValue, `${path}.${key}`);
  }
};

const assertSafeQueryObject = (query, path) => {
  if (!isPlainObject(query)) {
    throw new Error('Query must be a plain object');
  }

  for (const [key, value] of Object.entries(query)) {
    if (LOGICAL_QUERY_OPERATORS.has(key)) {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`${key} must be a non-empty array`);
      }
      value.forEach((item, index) => assertSafeQueryObject(item, `${path}.${key}[${index}]`));
      continue;
    }

    if (key.startsWith('$')) {
      throw new Error(`Unsafe top-level query operator: ${key}`);
    }
    assertSafeQueryFieldValue(value, `${path}.${key}`);
  }
};

const validateMongoQuery = (query) => {
  assertSafeQueryObject(query, 'query');
  return true;
};

const assertSafeUpdateValue = (value, path) => {
  if (Array.isArray(value)) {
    throw new Error(`Unsafe array update value at ${path}`);
  }

  if (isScalar(value)) {
    return;
  }

  if (value instanceof RegExp || typeof value === 'function' || Buffer.isBuffer(value)) {
    throw new Error(`Unsafe update value type at ${path}`);
  }

  if (!isPlainObject(value)) {
    throw new Error(`Unsafe update value type at ${path}`);
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === '$each') {
      if (!Array.isArray(nestedValue) || nestedValue.length > 100) {
        throw new Error(`Unsafe $each value at ${path}.${key}`);
      }
      nestedValue.forEach((item, index) => assertSafeUpdateValue(item, `${path}.${key}[${index}]`));
      continue;
    }

    assertSafeUpdateValue(nestedValue, `${path}.${key}`);
  }
};

const validateMongoUpdate = (update) => {
  if (!isPlainObject(update)) {
    throw new Error('Update must be a plain object');
  }

  for (const [operator, fields] of Object.entries(update)) {
    if (!ALLOWED_UPDATE_OPERATORS.has(operator)) {
      throw new Error(`Unsafe update operator: ${operator}`);
    }

    if (!isPlainObject(fields)) {
      throw new Error(`Update ${operator} must be a plain object`);
    }

    for (const [field, value] of Object.entries(fields)) {
      if (!/^[A-Za-z0-9_.]+$/.test(field)) {
        throw new Error(`Unsafe update field: ${field}`);
      }

      if (operator === '$inc' && typeof value !== 'number') {
        throw new Error(`$inc value must be a number at ${field}`);
      }

      assertSafeUpdateValue(value, `${operator}.${field}`);
    }
  }

  return true;
};

const validateSort = (sort) => {
  if (!sort) {
    return sort;
  }

  if (!isPlainObject(sort)) {
    throw new Error('Sort must be a plain object');
  }

  for (const [field, direction] of Object.entries(sort)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(field)) {
      throw new Error(`Unsafe sort field: ${field}`);
    }

    if (![-1, 1, 'asc', 'desc', 'ascending', 'descending'].includes(direction)) {
      throw new Error(`Unsafe sort direction for ${field}`);
    }
  }

  return sort;
};

const normalizeLimit = (limit) => {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 50;
  }

  return Math.min(parsed, 100);
};

const normalizeSkip = (skip) => {
  const parsed = Number(skip);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

class SafeQueryBuilder {
  constructor(Model) {
    this.Model = Model;
  }

  findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ObjectId');
    }
    return this.Model.findById(id);
  }

  findOne(query) {
    validateMongoQuery(query);
    return this.Model.findOne(query);
  }

  find(query, options = {}) {
    validateMongoQuery(query);
    const safeOptions = {
      ...options,
      limit: normalizeLimit(options.limit),
      skip: normalizeSkip(options.skip),
      sort: validateSort(options.sort)
    };
    return this.Model.find(query, null, safeOptions);
  }

  countDocuments(query, options = {}) {
    validateMongoQuery(query);
    return this.Model.countDocuments(query, options);
  }

  updateOne(filter, update, options = {}) {
    validateMongoQuery(filter);
    validateMongoUpdate(update);
    return this.Model.updateOne(filter, update, options);
  }

  updateMany(filter, update, options = {}) {
    validateMongoQuery(filter);
    validateMongoUpdate(update);
    return this.Model.updateMany(filter, update, options);
  }

  deleteOne(filter) {
    validateMongoQuery(filter);
    return this.Model.deleteOne(filter);
  }

  deleteMany(filter) {
    validateMongoQuery(filter);
    return this.Model.deleteMany(filter);
  }

  findOneAndUpdate(filter, update, options = {}) {
    validateMongoQuery(filter);
    validateMongoUpdate(update);
    return this.Model.findOneAndUpdate(filter, update, options);
  }

  findByIdAndUpdate(id, update, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ObjectId');
    }
    validateMongoUpdate(update);
    return this.Model.findByIdAndUpdate(id, update, options);
  }

  findByIdAndDelete(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ObjectId');
    }
    return this.Model.findByIdAndDelete(id);
  }
}

module.exports = {
  validateMongoQuery,
  validateMongoUpdate,
  SafeQueryBuilder
};
