const mongoose = require('mongoose');

// Prevent common NoSQL injection patterns
const validateMongoQuery = (query) => {
    if (typeof query !== 'object') return true;
    
    const dangerousPatterns = [
        '$where',
        '$regex',
        'mapReduce',
        'function'
    ];
    
    const queryString = JSON.stringify(query);
    
    for (const pattern of dangerousPatterns) {
        if (queryString.includes(pattern)) {
            throw new Error(`Dangerous query pattern detected: ${pattern}`);
        }
    }
    
    return true;
};

// Safe query builder
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
            limit: Math.min(options.limit || 50, 100),  // Max 100 results
            skip: Math.max(options.skip || 0, 0),
            ...options
        };
        return this.Model.find(query, null, safeOptions);
    }
    
    updateOne(filter, update) {
        validateMongoQuery(filter);
        validateMongoQuery(update);
        return this.Model.updateOne(filter, update);
    }
    
    deleteOne(filter) {
        validateMongoQuery(filter);
        return this.Model.deleteOne(filter);
    }
}

module.exports = {
    validateMongoQuery,
    SafeQueryBuilder
};