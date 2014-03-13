var IterativeCompare = require( '..' ),
    assert = require('assert'),
    should = require('should'),
    Q = require( 'q' );

var async = function( fn ) { 
    setTimeout( fn, 0 );
}

function promiseIter(num) { 
    var r = [], j = 0, i = 0;
    while( j < num ) r.push( j++ );
    return function() { return Q( r[i++] ); };
};

function rawValIter(num) { 
    var r = [], j = 0, i = 0;
    while( j < num ) r.push( j++ );
    return function() { return Q( r[i++] ); };
};

describe( "IterativeCompare(opts)", function() { 
    it( "should have default comparison function", function() { 
        var cmp = new IterativeCompare();
        assert( typeof cmp.compareFn === "function" ) ;
    } )

    it( "should allow custom comparison function", function() { 
        var cmpFn = function(a,b) { return b - a; } 
        var cmp = new IterativeCompare( { compareFn: cmpFn } );
        assert( cmp.compareFn === cmpFn ) ;
    } )
    
    it( "should have default extractor function", function() { 
        var cmp = new IterativeCompare();
        assert( typeof cmp.extractFn === "function" ) ;
    } )
   
    it( "should allow custom extraction function", function() { 
        var exFn = function(a,b,c) { return { a: a, b: b, c: c }; } 
        var cmp = new IterativeCompare( { extractFn: exFn } );
        assert( cmp.extractFn === exFn );
    } )
    
} );

describe( "IterativeCompare#compare", function() { 
    it( "should allow iterators to return raw values", function(done) { 
        var cmp = new IterativeCompare();

        cmp.compare( rawValIter( 10 ), rawValIter( 11 ) ).then( function( result ) { 
            async( function() { 
                should( result[1] ).have.property( "exists" ).and.equal( "both" );
                should( result[10] ).have.property( "exists" ).and.equal( "right" );
                done();    
            } );
        }, function() { 
            async( function() { 
                assert( false );
                done();    
            } );
        } );
    } );
    it( "should allow iterators to return promises", function(done) { 
        var cmp = new IterativeCompare();
        
        cmp.compare( promiseIter( 10 ), promiseIter( 11 ) ).then( function( result ) { 
            async( function() { 
                assert( result.length == 11 );
                result[1].exists.should.equal( "both" );
                result[10].exists.should.equal( "right" );
                done();    
            } );
        }, function() { 
            async( function() { 
                assert( false );
                done();    
            } );
        } );
    } );
    it( "should work with empty iterators", function(done) { 
        var cmp = new IterativeCompare();
        
        cmp.compare( promiseIter( 0 ), promiseIter( 0 ) ).then( function( result ) { 
            async( function() { 
                assert( result.length === 0 );
                done();    
            } );
        }, function() { 
            async( function() { 
                assert( false );
                done();    
            } );
        } );
    } );

    it( "should work with recurseSync true", function(done) {
        var cmp = new IterativeCompare( { recurseSync: true } );
        
        cmp.compare( promiseIter( 3 ), promiseIter( 4 ) ).then( function( result ) { 
            async( function() { 
                assert( result.length == 4 );
                result[1].exists.should.equal( 'both' );
                result[3].exists.should.equal( 'right' );
                done();    
            } );
        }, function() { 
            async( function() { 
                assert( false );
                done();    
            } );
        } );
    } );

    it( "should notify deferred object with each comparison", function(done) {
        var cmp = new IterativeCompare( { recurseSync: true } );

        cmp.compare( promiseIter( 1 ), promiseIter( 1 ) ).progress( function( info ) {
            async( function() {
                info.length.should.equal( 1 );
                info[0].should.containEql( { value: 0, exists: "both" } );
                done();
            } );
        } );
    } );

    it( "should still work if iterator returns deferred instead of promise", function(done) { 
        var cmp = new IterativeCompare( { recurseSync: true } );
        
        function emptyIter() {
            var d = Q.defer();
            d.resolve( null );
            return d;
        }
        
        cmp.compare( emptyIter, promiseIter( 4 ) ).then( function( result ) { 
            async( function() { 
                assert( result.length === 4 );
                done();    
            } );
        } ).fail( function(err) { 
            async( function() { 
                assert( false );
                done();
            } );
        } );
    } );

    it( "should catch errors from iterator", function(done) { 
        var cmp = new IterativeCompare( { recurseSync: true } );
        
        function failIter() {
            var d = Q.defer();
            d.reject( "Error in iterator" );
            return d.promise;
        }
        
        cmp.compare( failIter, promiseIter( 4 ) ).then( function( result ) { 
            async( function() { 
                assert( false );
                done();    
            } );
        } ).fail( function(err) { 
            async( function() { 
                err.should.be.exactly( "Error in iterator" );
                done();
            } );
        } );
    } );    
        
} );