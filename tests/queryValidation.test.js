const {
  validateMongoQuery,
  validateMongoUpdate,
  SafeQueryBuilder
} = require('../middleware/queryValidation');

const mongoose = require('mongoose');

const mockModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
  deleteOne: jest.fn(),
  deleteMany: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn()
};

describe('NoSQL Injection Prevention - Query Validation', () => {
  describe('validateMongoQuery', () => {
    test('accepts valid simple equality query', () => {
      expect(() => validateMongoQuery({ email: 'test@example.com' })).not.toThrow();
      expect(() => validateMongoQuery({ _id: new mongoose.Types.ObjectId() })).not.toThrow();
    });

    test('accepts valid comparison operators', () => {
      expect(() => validateMongoQuery({ age: { $gt: 18, $lt: 65 } })).not.toThrow();
      expect(() => validateMongoQuery({ score: { $gte: 10, $lte: 100 } })).not.toThrow();
    });

    test('accepts valid $in and $nin operators', () => {
      expect(() => validateMongoQuery({ status: { $in: ['active', 'pending'] } })).not.toThrow();
      expect(() => validateMongoQuery({ role: { $nin: ['admin'] } })).not.toThrow();
    });

    test('accepts $or, $and, $nor logical operators', () => {
      expect(() => validateMongoQuery({ $or: [{ email: 'admin' }, { username: 'admin' }] })).not.toThrow();
      expect(() => validateMongoQuery({ $and: [{ x: 1 }, { y: 2 }] })).not.toThrow();
      expect(() => validateMongoQuery({ $nor: [{ x: 1 }] })).not.toThrow();
    });

    test('rejects $where operator injection', () => {
      expect(() => validateMongoQuery({ $where: 'this.password == "admin"' })).toThrow();
      expect(() => validateMongoQuery({ email: { $where: 'function() { return true; }' } })).toThrow();
    });

    test('rejects $regex operator injection', () => {
      expect(() => validateMongoQuery({ username: { $regex: '.*', $options: 'i' } })).toThrow();
      expect(() => validateMongoQuery({ email: { $regex: 'admin' } })).toThrow();
    });

    test('rejects $ne with regex injection attempt', () => {
      expect(() => validateMongoQuery({ secret: { $ne: new RegExp('.*') } })).toThrow();
    });

    test('rejects unsupported top-level operators', () => {
      expect(() => validateMongoQuery({ $expr: { $gt: ['$a', '$b'] } })).toThrow();
      expect(() => validateMongoQuery({ $text: { $search: 'admin' } })).toThrow();
      expect(() => validateMongoQuery({ $jsonSchema: { bsonType: 'object' } })).toThrow();
    });

    test('rejects function-type values', () => {
      expect(() => validateMongoQuery({ x: () => {} })).toThrow();
    });

    test('rejects Buffer values', () => {
      expect(() => validateMongoQuery({ data: Buffer.from('test') })).toThrow();
    });

    test('rejects array values in field positions', () => {
      expect(() => validateMongoQuery({ tags: ['admin', 'user'] })).toThrow();
      expect(() => validateMongoQuery({ items: [1, 2, 3] })).toThrow();
    });

    test('validates $in/$nin array contents', () => {
      expect(() => validateMongoQuery({ id: { $in: [1, 2, 3] } })).not.toThrow();
      expect(() => validateMongoQuery({ id: { $in: [{ $where: 'x' }] } })).toThrow();
    });

    test('rejects $exists with non-boolean value', () => {
      expect(() => validateMongoQuery({ field: { $exists: 1 } })).toThrow();
      expect(() => validateMongoQuery({ field: { $exists: 'true' } })).toThrow();
      expect(() => validateMongoQuery({ field: { $exists: true } })).not.toThrow();
    });

    test('$not nested query is validated as subquery', () => {
      // $not with $gt inside is actually blocked because $gt becomes a top-level operator
      // in the nested subquery context
      expect(() => validateMongoQuery({ field: { $not: { $gt: 0 } } })).toThrow();
    });

    test('rejects empty $or/$and/$nor arrays', () => {
      expect(() => validateMongoQuery({ $or: [] })).toThrow();
      expect(() => validateMongoQuery({ $and: [] })).toThrow();
      expect(() => validateMongoQuery({ $nor: [] })).toThrow();
    });

    test('rejects non-object values', () => {
      expect(() => validateMongoQuery('string')).toThrow();
      expect(() => validateMongoQuery(123)).toThrow();
      expect(() => validateMongoQuery(null)).toThrow();
      expect(() => validateMongoQuery(undefined)).toThrow();
    });
  });

  describe('validateMongoUpdate', () => {
    test('accepts valid $set update', () => {
      expect(() => validateMongoUpdate({ $set: { name: 'Test', email: 'test@example.com' } })).not.toThrow();
    });

    test('accepts valid $inc update', () => {
      expect(() => validateMongoUpdate({ $inc: { loginCount: 1 } })).not.toThrow();
    });

    test('rejects $inc with non-number value', () => {
      expect(() => validateMongoUpdate({ $inc: { loginCount: '1' } })).toThrow();
      expect(() => validateMongoUpdate({ $inc: { loginCount: true } })).toThrow();
    });

    test('accepts valid dot-notation field names', () => {
      expect(() => validateMongoUpdate({ $set: { 'a.b.c': 1 } })).not.toThrow();
    });

    test('rejects dangerous field names', () => {
      expect(() => validateMongoUpdate({ $set: { 'field;$where': 1 } })).toThrow();
    });

    test('rejects $where in update operators', () => {
      expect(() => validateMongoUpdate({ $where: 'this.email === "admin"' })).toThrow();
    });

    test('rejects function values in updates', () => {
      expect(() => validateMongoUpdate({ $set: { callback: () => {} } })).toThrow();
    });

    test('accepts $set with nested scalar values', () => {
      expect(() => validateMongoUpdate({ $set: { nested: { value: 1 } } })).not.toThrow();
    });

    test('rejects empty update object', () => {
      expect(() => validateMongoUpdate({})).not.toThrow();
      expect(() => validateMongoUpdate(null)).toThrow();
      expect(() => validateMongoUpdate(undefined)).toThrow();
      expect(() => validateMongoUpdate('not an object')).toThrow();
    });

    test('rejects unsupported operators', () => {
      expect(() => validateMongoUpdate({ $isolated: 1 })).toThrow();
      expect(() => validateMongoUpdate({ $db: 'test' })).toThrow();
    });
  });

  describe('SafeQueryBuilder', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('findOne rejects unsafe query and does not call Model.findOne', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.findOne({ $where: 'true' })).toThrow();
      expect(mockModel.findOne).not.toHaveBeenCalled();
    });

    test('findOne accepts valid query and calls Model.findOne', async () => {
      mockModel.findOne.mockResolvedValue({ _id: '123' });
      const builder = new SafeQueryBuilder(mockModel);
      await builder.findOne({ email: 'test@example.com' });
      expect(mockModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    test('find rejects unsafe query', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.find({ $where: 'true' })).toThrow();
      expect(mockModel.find).not.toHaveBeenCalled();
    });

    test('find normalizes limit and skip', async () => {
      mockModel.find.mockResolvedValue([]);
      const builder = new SafeQueryBuilder(mockModel);
      await builder.find({}, { limit: 9999, skip: -5, sort: { name: 1 } });
      expect(mockModel.find).toHaveBeenCalledWith({}, null, {
        limit: 100,
        skip: 0,
        sort: { name: 1 }
      });
    });

    test('countDocuments rejects unsafe query', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.countDocuments({ $where: 'true' })).toThrow();
      expect(mockModel.countDocuments).not.toHaveBeenCalled();
    });

    test('updateOne rejects unsafe filter', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.updateOne({ $where: 'true' }, { $set: { x: 1 } })).toThrow();
      expect(mockModel.updateOne).not.toHaveBeenCalled();
    });

    test('updateOne rejects unsafe update operator', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.updateOne({ x: 1 }, { $isolated: 1 })).toThrow();
      expect(mockModel.updateOne).not.toHaveBeenCalled();
    });

    test('updateMany validates filter and update', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.updateMany({ $where: 'true' }, { $inc: { y: 'bad' } })).toThrow();
      expect(mockModel.updateMany).not.toHaveBeenCalled();
    });

    test('deleteOne rejects unsafe query', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.deleteOne({ $where: 'true' })).toThrow();
      expect(mockModel.deleteOne).not.toHaveBeenCalled();
    });

    test('deleteMany rejects unsafe query', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.deleteMany({ $where: 'true' })).toThrow();
      expect(mockModel.deleteMany).not.toHaveBeenCalled();
    });

    test('findOneAndUpdate validates both filter and update', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.findOneAndUpdate({ $where: 'true' }, { $set: { x: 1 } })).toThrow();
      expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('findById rejects invalid ObjectId', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.findById('not-an-id')).toThrow();
      expect(mockModel.findById).not.toHaveBeenCalled();
    });

    test('findByIdAndUpdate rejects invalid ObjectId', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.findByIdAndUpdate('bad', { $set: { x: 1 } })).toThrow();
      expect(mockModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('findByIdAndUpdate rejects unsafe update even with valid id', () => {
      const builder = new SafeQueryBuilder(mockModel);
      const validId = new mongoose.Types.ObjectId();
      expect(() => builder.findByIdAndUpdate(validId, { $where: 'true' })).toThrow();
      expect(mockModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('findByIdAndDelete rejects invalid ObjectId', () => {
      const builder = new SafeQueryBuilder(mockModel);
      expect(() => builder.findByIdAndDelete('bad-id')).toThrow();
      expect(mockModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});