/*
	ABMap.js
	--------

	A two-way map that allows for quick lookups in both directions.
	Includes relationships for:
	- 1:1
	- 1:N
	- N:1
	- N:N

	TODO: Add more documentation
*/	

export class ABMap {
	constructor(options = {}) {
		this.aToB = new Map();
		this.bToA = new Map();
		this._frozen = false;
		this._keyFn = options.keyFn || (k => k);
	}

	_normalize(keys) {
		return Array.isArray(keys) ? keys : [keys];
	}

	_checkFrozen() {
		if (this._frozen) throw new Error("ABMap is frozen and cannot be mutated.");
	}

	_add(mapFrom, mapTo, keys, values) {
		this._checkFrozen();
		const fromKeys = this._normalize(keys).map(this._keyFn);
		const toKeys = this._normalize(values).map(this._keyFn);

		for (let fromKey of fromKeys) {
			let current = mapFrom.get(fromKey) || new Set();
			for (let toKey of toKeys) {
				current.add(toKey);

				let reverse = mapTo.get(toKey) || new Set();
				reverse.add(fromKey);
				mapTo.set(toKey, reverse);
			}
			mapFrom.set(fromKey, current);
		}
	}

	addA(keyOrKeys, valueOrValues) {
		this._add(this.aToB, this.bToA, keyOrKeys, valueOrValues);
	}

	addB(keyOrKeys, valueOrValues) {
		this._add(this.bToA, this.aToB, keyOrKeys, valueOrValues);
	}

	_get(map, keyOrKeys) {
		const keys = this._normalize(keyOrKeys).map(this._keyFn);
		return keys.map(k => map.get(k) ? Array.from(map.get(k)) : null);
	}

	getA(keyOrKeys) {
		const result = this._get(this.aToB, keyOrKeys);
		return Array.isArray(keyOrKeys) ? result : result[0];
	}

	getB(keyOrKeys) {
		const result = this._get(this.bToA, keyOrKeys);
		return Array.isArray(keyOrKeys) ? result : result[0];
	}

	get(keyOrKeys) {
		const aVals = this.getA(keyOrKeys);
		const bVals = this.getB(keyOrKeys);
		if (Array.isArray(keyOrKeys)) {
			return aVals.map((a, i) => {
				const b = bVals[i];
				return a && b ? [...new Set([...a, ...b])] : a || b;
			});
		} else {
			return [...new Set([...(aVals || []), ...(bVals || [])])];
		}
	}

	_set(mapFrom, mapTo, keyOrKeys, newValue) {
		this._checkFrozen();
		const fromKeys = this._normalize(keyOrKeys).map(this._keyFn);
		const newValues = this._normalize(newValue).map(this._keyFn);

		for (let fromKey of fromKeys) {
			const oldSet = mapFrom.get(fromKey);
			if (oldSet) {
				for (let oldValue of oldSet) {
					const reverseSet = mapTo.get(oldValue);
					if (reverseSet) {
						reverseSet.delete(fromKey);
						if (!reverseSet.size) mapTo.delete(oldValue);
					}
				}
			}
			mapFrom.set(fromKey, new Set(newValues));
			for (let val of newValues) {
				let reverse = mapTo.get(val) || new Set();
				reverse.add(fromKey);
				mapTo.set(val, reverse);
			}
		}
	}

	setA(keyOrKeys, newValue) {
		this._set(this.aToB, this.bToA, keyOrKeys, newValue);
	}

	setB(keyOrKeys, newValue) {
		this._set(this.bToA, this.aToB, keyOrKeys, newValue);
	}

	set(keyOrKeys, newValue) {
		this.setA(keyOrKeys, newValue);
		this.setB(newValue, keyOrKeys);
	}

	setAB(keyA, keyB) {
		this.deleteA(keyA);
		this.deleteB(keyB);
		this.set(keyA, keyB);
	}

	_has(map, keyOrKeys) {
		return this._normalize(keyOrKeys).map(this._keyFn).map(k => map.has(k));
	}

	hasA(keyOrKeys) {
		const result = this._has(this.aToB, keyOrKeys);
		return Array.isArray(keyOrKeys) ? result : result[0];
	}

	hasB(keyOrKeys) {
		const result = this._has(this.bToA, keyOrKeys);
		return Array.isArray(keyOrKeys) ? result : result[0];
	}

	has(keyOrKeys) {
		const keys = this._normalize(keyOrKeys).map(this._keyFn);
		return keys.map(k => this.aToB.has(k) || this.bToA.has(k));
	}

	_delete(mapFrom, mapTo, keyOrKeys) {
		this._checkFrozen();
		const keys = this._normalize(keyOrKeys).map(this._keyFn);
		for (let key of keys) {
			const values = mapFrom.get(key);
			if (values) {
				for (let val of values) {
					const reverse = mapTo.get(val);
					if (reverse) {
						reverse.delete(key);
						if (!reverse.size) mapTo.delete(val);
					}
				}
				mapFrom.delete(key);
			}
		}
	}

	deleteA(keyOrKeys) {
		this._delete(this.aToB, this.bToA, keyOrKeys);
	}

	deleteB(keyOrKeys) {
		this._delete(this.bToA, this.aToB, keyOrKeys);
	}

	delete(keyOrKeys) {
		this.deleteA(keyOrKeys);
		this.deleteB(keyOrKeys);
	}

	countA() {
		return this.aToB.size;
	}

	countB() {
		return this.bToA.size;
	}

	count() {
		return new Set([...this.aToB.keys(), ...this.bToA.keys()]).size;
	}

	countAB() {
		let total = 0;
		for (let vals of this.aToB.values()) total += vals.size;
		return total;
	}

	sizeA(key) {
		const val = this.aToB.get(this._keyFn(key));
		return val ? val.size : 0;
	}

	sizeB(key) {
		const val = this.bToA.get(this._keyFn(key));
		return val ? val.size : 0;
	}

	keysA() {
		return this.aToB.keys();
	}

	keysB() {
		return this.bToA.keys();
	}

	entriesA() {
		return this.aToB.entries();
	}

	entriesB() {
		return this.bToA.entries();
	}

	valuesA() {
		return Array.from(this.aToB.values());
	}

	valuesB() {
		return Array.from(this.bToA.values());
	}

	toPairs() {
		const pairs = [];
		for (let [a, bs] of this.aToB.entries()) {
			for (let b of bs) {
				pairs.push({ a, b });
			}
		}
		return pairs;
	}

	forEachA(callback) {
		for (let [a, bs] of this.aToB.entries()) {
			callback(a, Array.from(bs));
		}
	}

	forEachB(callback) {
		for (let [b, as] of this.bToA.entries()) {
			callback(b, Array.from(as));
		}
	}

	pruneA(predicate) {
		this._checkFrozen();
		for (let [a, bs] of this.aToB.entries()) {
			if (!predicate(a, Array.from(bs))) {
				this.deleteA(a);
			}
		}
	}

	pruneB(predicate) {
		this._checkFrozen();
		for (let [b, as] of this.bToA.entries()) {
			if (!predicate(b, Array.from(as))) {
				this.deleteB(b);
			}
		}
	}

	freeze() {
		this._frozen = true;
	}

	clone() {
		const clone = new ABMap({ keyFn: this._keyFn });
		for (let [a, bs] of this.aToB.entries()) {
			clone.aToB.set(a, new Set(bs));
		}
		for (let [b, as] of this.bToA.entries()) {
			clone.bToA.set(b, new Set(as));
		}
		return clone;
	}

	toJSON() {
		const serializeMap = (map) => {
			const obj = {};
			for (const [key, valSet] of map.entries()) {
				obj[JSON.stringify(key)] = Array.from(valSet).map(v => JSON.stringify(v));
			}
			return obj;
		};
		return JSON.stringify({
			aToB: serializeMap(this.aToB),
			bToA: serializeMap(this.bToA)
		});
	}

	static fromJSON(jsonStr) {
		const parseKey = k => JSON.parse(k);
		const obj = JSON.parse(jsonStr);
		const mapify = (obj) => {
			const result = new Map();
			for (const [k, vArr] of Object.entries(obj)) {
				result.set(parseKey(k), new Set(vArr.map(parseKey)));
			}
			return result;
		};
		const abmap = new ABMap();
		abmap.aToB = mapify(obj.aToB);
		abmap.bToA = mapify(obj.bToA);
		return abmap;
	}
}
