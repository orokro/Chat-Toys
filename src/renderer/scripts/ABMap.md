# ABMap 🔁

A high-performance, flexible, bidirectional multimap for JavaScript. Supports many-to-many relationships, batch operations, custom key comparison, and rich utilities for querying, transforming, and maintaining symmetrical mappings.

---

## 🧠 Why ABMap?

Sometimes you need to map from `A -> B`, but also query `B -> A`. This class ensures that when one side is updated, the other stays in sync — like usernames ↔ userIds, emails ↔ accounts, or tags ↔ documents.

---

## 🚀 Features

- 🔁 **Bidirectional**: Automatically keeps both A→B and B→A in sync
- 📦 **Batch Operations**: Pass arrays to all `add`, `set`, `get`, `delete`, etc.
- ♻️ **Deduplication**: Never stores redundant mappings
- 🔍 **Powerful Lookups**: Get all related values in any direction
- 🧩 **Custom Key Normalization**: Use `.toLowerCase()`, JSON.stringify, or any hash
- 🧊 **Freezing**: Lock the instance to prevent mutations
- 🧪 **Serialization**: to/from JSON support
- 🛠️ **Utility Methods**: clone, toPairs, iterators, pruning, etc.

---

## 📦 Installation

Just copy `ABMap.js` into your project, or import it via ES module.

```js
import ABMap from './ABMap.js';
```

---

## ✨ Basic Usage

```js
const map = new ABMap();

map.addA('user1', 123);
map.addB(999, 'user1');

console.log(map.getA('user1')); // [123, 999]
console.log(map.getB(123));     // ['user1']
```

---

## ⚙️ API

### Add / Set / Get

| Method | Description |
|--------|-------------|
| `addA(a, b)` | Add link(s) from A to B |
| `addB(b, a)` | Add link(s) from B to A |
| `setA(a, b)` | Overwrite all B values for A |
| `setB(b, a)` | Overwrite all A values for B |
| `set(a, b)` | Overwrites both directions |
| `setAB(a, b)` | Deletes all old links from both `a` and `b`, then links them |

### Getters

```js
getA(a)
getB(b)
get(key) // from either side
```

All accept singular or array values:
```js
getA(['x', 'y']) // returns array of arrays
```

### Presence Checks

```js
hasA(key)
hasB(key)
has(key)
```

### Delete

```js
deleteA(key)
deleteB(key)
delete(key)
```

---

## 🔄 Iteration

```js
map.forEachA((a, bs) => {
  console.log(a, bs);
});

map.forEachB((b, as) => {
  console.log(b, as);
});
```

---

## 🌲 Pruning (Mutates In Place)

```js
map.pruneA((a, bs) => bs.length > 1); // delete entries with <= 1 mapping
map.pruneB((b, as) => someCheck(b));
```

---

## 📊 Counts

```js
countA()
countB()
count()    // unique keys across both
countAB()  // total mappings
sizeA(key)
sizeB(key)
```

---

## 🧱 Meta Tools

```js
map.freeze() // lock from mutation
const copy = map.clone();
```

---

## 🔁 Serialization

```js
const json = map.toJSON();
const restored = ABMap.fromJSON(json);
```

---

## 🔐 Custom Key Hashing

Want to support object keys or case-insensitive strings?

```js
const map = new ABMap({
  keyFn: k => typeof k === 'string' ? k.toLowerCase() : JSON.stringify(k)
});
```

---

## 📤 Export All Pairs

```js
map.toPairs(); // [{ a: 'foo', b: 123 }, { a: 'foo', b: 456 }]
```

---

## 🧪 Example

```js
const foo = new ABMap();

foo.addA(['a', 'b'], 1);
foo.addB(2, 'a');
foo.setAB('c', 3);

console.log(foo.getA('a')); // [1, 2]
console.log(foo.getB(3));   // ['c']
console.log(foo.toPairs());
```

---

## 📝 License

TBA 💫
