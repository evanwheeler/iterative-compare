var Q = require( 'q' );

// You can swap out some of these dependencies.
var Deferred = Q.defer,
    all = Q.all,
    isPromise = Q.isPromise;
   
/**
 * Accepts input as promise, deferred, or value and returns a promise. 
 */ 
function ensurePromise( obj ) { 
    if( isPromise( obj ) ) return obj;
    if( obj && obj.promise ) return obj.promise;

    // coerce to promise.
    return Q( obj );
}
    
/**
 * Normalizes calls to different iterator interfaces. Convert returned values into promises if necessary.
 * @param iter - The iterator.
 * @returns {*} A promise to be resolved to a next value.
 */
function callIter( iter ) {
    var result;
    
    if( typeof( iter ) === "function" ) result = iter();
    else if( typeof( iter.next ) === "function" ) result = iter.next();
    else throw new Error( "Iterator is not invokable" );
    
    // If iter may return a promise, deferred, or value -- always return a promise.
    return ensurePromise( result );
}

/**
 * Returns true if v is not undefined or null.
 */
function nullish( v ) {
    return v === null || typeof v === 'undefined';
}

/**
 * Returns true if v is not undefined or null.
 */
function isVal( v ) {
    return v !== null && typeof v !== 'undefined';
}

/**
 * Default comparison function.
 * @param a - First item
 * @param b - Second item
 * @returns {number} -1, 0, 1
 */
function defaultCmp( a, b ) {
    return a === b ? 0 : ( a < b ? -1 : 1 );
}

/**
 * Returns an item to insert into the result list.  Both v1 and v2 will be supplied if the
 * result of comparison was 0.
 * @param v1 - The first value (or null if there was no first value).
 * @param v2 - The second value (or null if there was no second value).
 * @param {number} cmpResult - The result of the comparison function.
 * @returns {*} The value that will be added to the results.
 */
function defaultExtract( v1, v2, cmpResult ) {
    if( isVal( v1 ) && isVal( v2 ) ) {
        // we can still do a deeper comparison here if needed.
        return { value: v1, exists: "both" };
    }
    else if( isVal( v1 ) ) {
        // we can still do a deeper comparison here if needed.
        return { value: v1, exists: "left" };
    }
    else if( isVal( v2 ) ) {
        // we can still do a deeper comparison here if needed.
        return { value: v2, exists: "right" };
    }
    throw new Error( "Invalid arguments passed to defaultExtract" );
}

/**
 * Object for performing a comparison of two iterators.  Accepts option for compareFn
 * to customize the comparison and extractFn to return a result based on the comparison.
 * Iterators should either be functions which return a promise or a value
 * for the next item or an object with a next() method, which returns a promise or a value.
 * @param options - Override options.
 * @constructor
 */
var IterativeCompare = module.exports = function( options ) {
    options = options || {};

    this.compareFn = options.compareFn || defaultCmp;
    this.extractFn = options.extractFn || defaultExtract;

    this._deferred = null;
};

IterativeCompare.prototype = {

    /**
     * Starts the comparison
     * @param iter1 - First iterator
     * @param iter2 - Second iterator
     * @returns {promise} a promise which will be fulfilled with the differences.
     */
    compare: function( iter1, iter2 ) {
        if( this._deferred ) {
            // don't allow multiple compares.
            throw new Error( "Already comparing" );
        }

        this._iter1 = iter1;
        this._iter2 = iter2;
        this._results = [];
        this._deferred = Deferred();

        // start the comparison.
        this._stepBoth();

        return this._deferred.promise;
    },

    /**
     * Adds a result and updates the promise's progress.
     * @param v1 - The left value.
     * @param v2 - The right value.
     * @param {integer} cmpResult - The result of the comparison or null if objects weren't compared.
     * @private
     */
    _addResult: function( v1, v2, cmpResult ) {
        var r;

        if( cmpResult === 0 && isVal(v1) && isVal(v2) ) {
            // The comparison was equal -- pass both values to extract result.
            r = this.extractFn( v1, v2, cmpResult );
        }
        else if( cmpResult < 0 || nullish( v2 ) ) {
            // Item from left list was not in right list.
            r = this.extractFn( v1, null, -1 );
        }
        else if( cmpResult > 0 || nullish( v1 ) ) {
            // Item from right list was not in left list.
            r = this.extractFn( null, v2, 1 );
        }

        if( r ) {
            this._results.push( r );

            // notify about progress.
            this._deferred.notify( this._results );
        }
    },

    /**
     * Compares two values. Advances both iterators if values are equal, or just the
     * lesser value if they are different.
     * @param val1 - Value from the first iterator.
     * @param val2 - Value from the second iterator.
     */
    _compareValues: function( val1, val2 ) {
        var d = this._deferred;

        if( isVal( val1 ) && isVal( val2 ) ) {
            // we have two items to compare ...
            var cmp = this.compareFn( val1, val2 );

            // add the result.
            this._addResult( val1, val2, cmp );

            // next step.
            this._step( val1, val2, cmp );
        }
        else if( isVal( val1 ) ) {
            // advance left until end.
            this._addResult( val1, null, null );
            this._stepLeft( null );
        }
        else if( isVal( val2 ) ) {
            // advance right until end.
            this._addResult( null, val2, null );
            this._stepRight( null );
        }
        else {
            // both are at the end.
            this._resolve( this._results );
        }
    },

    /**
     * Selects the correct step given the last two values and compare result.
     * @param v1 - First value.
     * @param v2 - Second value.
     * @param {integer} cmp - Result of comparison (should be non-null).
     */
    _step: function( v1, v2, cmp ) {
        if( cmp === 0 ) {
            this._stepBoth();
        }
        else if( cmp < 0 ) {
            this._stepLeft( v2 );
        }
        else {
            this._stepRight( v1 );
        }
    },

    /**
     * Steps the first iterator and then compares the value with the current right value.
     * @param rightVal - Value from the second iterator.
     */
    _stepLeft: function( rightVal ) {
        var self = this;
        callIter( self._iter1 )
            .then( function( v ) {
                self._compareValues( v, rightVal );
            } )
            .fail( function( err ) {
                self._fail( err );
            } )
            .done();
    },

    /**
     * Steps the second iterator and then compares the value with the current left value.
     * @param leftVal - The value from the first iterator.
     */
    _stepRight: function( leftVal ) {
        var self = this;
        callIter( self._iter2 )
            .then( function( v ) {
                self._compareValues( leftVal, v );
            } )
            .fail( function( err ) {
                self._fail( err );
            } )
            .done();
    },

    /**
     * Steps both iterators and then compares the results.
     */
    _stepBoth: function() {
        var self = this;
        
        all( [ callIter( this._iter1 ), callIter( this._iter2 ) ] ).done( function( results ) {
            self._compareValues( results[0], results[1] );
        } , function( err ) {
            self._fail( err );
        } );
    },
    
    /**
     * Ends the comparison and returns a result
     * @param result - The result to return.
     */
    _resolve: function( result ) { 
        var d = this._deferred;
        this._deferred = null;
        d.resolve( result );
    },

    /**
     * Ends the comparison and fails with an error
     * @param result - The result to return.
     */
    _fail: function( err ) { 
        var d = this._deferred;
        this._deferred = null;
        d.reject( err );
    }
};

