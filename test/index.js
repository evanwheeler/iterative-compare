var IterativeCompare = require( '..' ),
    assert = require('assert'),
    should = require('should'),
    Q = require( 'q' );

var async = function( fn ) { 
    setTimeout( fn, 0 );
}

function makeIterForList( list )  {
    var i = 0;
    return function() {
        return list[i++];
    };
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

    it( "should notify deferred object with each comparison", function(done) {
        var cmp = new IterativeCompare();

        cmp.compare( promiseIter( 1 ), promiseIter( 1 ) ).progress( function( info ) {
            async( function() {
                info.length.should.equal( 1 );
                info[0].should.containEql( { value: 0, exists: "both" } );
                done();
            } );
        } );
    } );

    it( "should still work if iterator returns deferred instead of promise", function(done) { 
        var cmp = new IterativeCompare();
        
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
        var cmp = new IterativeCompare();
        
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

    it( 'should return correct results', function(done) {
        var cmp = new IterativeCompare(),
            iter1 = makeIterForList( [ 1, 11 ] ),
            iter2 = makeIterForList( [ 2, 4, 9, 11 ] );

        cmp.compare( iter1, iter2).then( function( result ) {

            async( function()  {

                result.length.should.equal( 5 );

                result[0].should.have.property( 'exists').and.equal( 'left' );
                result[0].should.have.property( 'value' ).and.equal( 1 );

                result[1].should.have.property( 'exists').and.equal( 'right' );
                result[1].should.have.property( 'value' ).and.equal( 2 );

                result[2].should.have.property( 'exists').and.equal( 'right' );
                result[2].should.have.property( 'value' ).and.equal( 4 );

                result[3].should.have.property( 'exists').and.equal( 'right' );
                result[3].should.have.property( 'value' ).and.equal( 9 );

                result[4].should.have.property( 'exists').and.equal( 'both' );
                result[4].should.have.property( 'value' ).and.equal( 11 );

                done();
            } );

        }).done();
    } );
    it( 'should return correct results for strings', function(done) {
        var cmp = new IterativeCompare(),
            iter1 = makeIterForList( [ "Abbey", "Zara", "Zilch" ] ),
            iter2 = makeIterForList( [ "Abbey", "Mike", "Ted", "Zara", "Zorg" ] );

        cmp.compare( iter1, iter2).then( function( result ) {

            async( function()  {

                result.length.should.equal( 6 );

                result[0].should.have.property( 'exists').and.equal( 'both' );
                result[0].should.have.property( 'value' ).and.equal( "Abbey" );

                result[1].should.have.property( 'exists').and.equal( 'right' );
                result[1].should.have.property( 'value' ).and.equal( "Mike" );

                result[2].should.have.property( 'exists').and.equal( 'right' );
                result[2].should.have.property( 'value' ).and.equal( "Ted" );

                result[3].should.have.property( 'exists').and.equal( 'both' );
                result[3].should.have.property( 'value' ).and.equal( "Zara" );

                result[4].should.have.property( 'exists').and.equal( 'left' );
                result[4].should.have.property( 'value' ).and.equal( "Zilch" );

                result[5].should.have.property( 'exists').and.equal( 'right' );
                result[5].should.have.property( 'value' ).and.equal( "Zorg" );

                done();
            } );

        }).done();
    } );
} );