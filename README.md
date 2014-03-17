# iterative-compare

_iterative-compare_ is a simple utility to help compare two ordered lists of data. It traverses each list by repeatedly advancing two iterators. It returns a promise which is fulfilled with the results when the comparison is complete. A comparison function can be passed to the constructor, which determines order and tests for missing items. An extraction function can be supplied to customize how the results are returned.

## To begin

Install it:
    
  ```bash
  $ npm install iterative-compare --save
  ```

## Example

```javascript
var IterativeCompare = require('iterative-compare');

var leftList = [ "Adam", "John", "Phil", "Steve" ],
    rightList = [ "Aaron", "John", "Phil", "Steven", "Travis" ];

function makeIter( list ) { 
    var i = 0;
    return function() { return list[i++]; }
}

var comparer = new IterativeCompare();

comparer.compare(  
  makeIter( leftList ), 
  makeIter( rightList ) 
)
.then( function( results ) { 
  results.forEach( function(v) { 
    if( v.exists !== 'both' ) { 
      console.log( v.value + " only exists in the " + v.exists + " list" );
    }
  }
} );

/*
  Outputs: 
  Aaron only exists in the right list
  Adam only exists in the left list
  Steve only exists in the left list
  Steven only exists in the right list
  Travis only exists in the right list
*/
```
