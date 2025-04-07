/*
	ThreeQuery.js
	-------------

	First take on a jQuery-like query system for Three.js objects.
*/

/**
 * Main library
 */
class ThreeQuery {

	/**
	 * Constructs a ThreeQuery instance.
	 * 
	 * @param {scene} scene - the ThreeJS Scene
	 */
	constructor(scene) {

		// save ref to our scene
		this.scene = scene;

		// maps for #IDs and .classes to quickly find objects
		this.idMap = new Map();
		this.classMap = new Map();

		// custom callbacks for loading objects so we auto-scan them
		this.loaders = new Map();

		// scan the existing scene for objects w/ IDs and classes
		this.scan(scene);
	}


	/**
	 * Adds a custom loader function so we can auto-scan geometry as we load it in.
	 * 
	 * @param {String} type - the type of loader (e.g. 'gltf', 'fbx', etc.)
	 * @param {Function} loaderFn - code to run to load a file, and auto-scan it before returnng it
	 */
	addLoader(type, loaderFn) {
		this.loaders.set(type, loaderFn);
	}


	/**
	 * Loads geometry with one of our pre-established loaders.
	 * 
	 * @param {String} type - the type of loader (e.g. 'gltf', 'fbx', etc.)
	 * @param {String|Object} src - the source of the file to load
	 * @returns {Promise<Object>} - the loaded object
	 */
	async loadGeometry(type, src) {

		// get our loader function, if defined
		const loader = this.loaders.get(type);
		if (!loader) 
			throw new Error(`No loader for type ${type}`);

		// load the object
		const obj = await loader(src);

		// scan the object for IDs and classes before returning
		this.scan(obj);
		return obj;
	}

	/**
	 * Recursively scans an object and its children for IDs and classes.
	 * 
	 * @param {Object} object - the object to scan
	 */
	scan(object) {

		// gtfo if we don't have an object
		if (!object)
			return;

		// recursively scan the object and its children
		object.traverse(child => {

			// for now, GLTFs from Blender for instance will store the name in userData.name
			if (!child.userData.name)
				return;

			// parse out ID and potential classes, iif any
			const { id, classes } = ThreeQuery.parseName(child.userData.name);

			// if we have an ID, add it to our ID map
			if (id) {
				if (!this.idMap.has(id)) this.idMap.set(id, []);
				this.idMap.get(id).push(child);
			}

			// if we have classes, add them to our class map
			for (let cls of classes) {
				if (!this.classMap.has(cls)) this.classMap.set(cls, []);
				this.classMap.get(cls).push(child);
			}

			// store the ID and classes on the object for later use
			child._threeQueryMeta = { id, classes: new Set(classes) };
		});
	}


	/**
	 * Parses a name that might have ID or classes like "#id .class1 .class2"
	 * @param {String} name - the name of the object to parse
	 * @returns {Object} - an object with the ID and classes
	 */
	static parseName(name) {

		// regex to find patterns like #id and .class1 .class2
		const idMatch = name.match(/#(\w+)/);
		const classMatches = [...name.matchAll(/\.(\w+)/g)].map(m => m[1]);

		// pack up our results
		return {
			id: idMatch ? idMatch[1] : null,
			classes: classMatches || []
		};
	}


	/**
	 * Main query function to find objects in the scene.
	 * 
	 * @param {String} selector - CSS-like selector to find objects
	 * @param {Object} context - the context to search in (default: the scene)
	 * @returns {ThreeQueryResult} - a ThreeQueryResult object with the found objects
	 */
	query(selector, context = this.scene) {

		// split the selector into parts, e.g. "#id .class"
		const selectors = selector.trim().split(/\s+/);

		// search function to find objects matching the selector
		const search = (objs, idx) => {

			// idx is the index of the selector we're looking for
			// if we run out, we're done matching
			if (idx >= selectors.length)
				return objs;

			// get the selector to mach
			const sel = selectors[idx];
			let next = new Set();

			// check if our objects match the selector
			objs.forEach(obj => {
				obj.traverse(child => {
					if (ThreeQuery.matches(child, sel)) {
						next.add(child);
					}
				});
			});

			// recurse to the next selector
			return search(next, idx + 1);
		};

		// return a new result with the matched items
		return new ThreeQueryResult([...search(new Set([context]), 0)], this);
	}
	

	/**
	 * Checks if an object matches a selector.
	 * 
	 * @param {Object} obj - the object to check
	 * @param {String} selector - the selector to match against
	 * @returns {Boolean} - true if the object matches the selector, false otherwise
	 */
	static matches(obj, selector) {

		// if we don't have a meta object, we can't match
		if (!obj._threeQueryMeta)
			return false;

		// check if the object has an ID or classes that match the selector
		const { id, classes } = obj._threeQueryMeta;
		const idMatch = selector.match(/^#(\w+)/);
		const classMatches = [...selector.matchAll(/\.(\w+)/g)].map(m => m[1]);

		// if id mismatch, return false
		if (idMatch && id !== idMatch[1])
			return false;

		// if we have classes, check if they match
		for (let cls of classMatches)
			if (!classes.has(cls))
				return false;
		
		// if we have no ID or classes, return true
		return true;
	}

	/**
	 * Short hand for the query function.
	 * 
	 * @param {String} selector - a CSS-like selector to find objects
	 * @returns {ThreeQueryResult} - a new ThreeQueryResult instance with the found objects
	 */
	$(selector) {
		return this.query(selector);
	}
}


/**
 * This class is the kind of object that will be returned for a query.
 * 
 * This will allow for jQuery-like chaining of methods.
 */
class ThreeQueryResult {

	/**
	 * Constructs a ThreeQueryResult instance.
	 * 
	 * @param {Array} objects - the objects to include in the result
	 * @param {ThreeQuery} root - the root ThreeQuery instance
	 * @returns {ThreeQueryResult} - the new ThreeQueryResult instance
	 */
	constructor(objects, root) {
		this.objects = objects;
		this.root = root;
	}


	/**
	 * Method to loop over all the items in the result
	 * 
	 * @param {Function} fn - a function to call for each object
	 * @returns {ThreeQueryResult} - the ThreeQueryResult instance
	 */
	each(fn) {
		this.objects.forEach(fn);
		return this;
	}


	/**
	 * Search results for objects matching a selector.
	 * 
	 * @param {String} selector - a CSS-like selector to find objects
	 * @returns {ThreeQueryResult} - a new ThreeQueryResult instance with the found objects	
	 */
	find(selector) {
		const found = [];
		this.objects.forEach(obj => {
			const res = this.root.query(selector, obj);
			found.push(...res.objects);
		});
		return new ThreeQueryResult(found, this.root);
	}


	/**
	 * Either sets the results scale, or returns the scale of the first object.
	 * 
	 * @param {Number} x - the x scale
	 * @param {Number} y - the y scale
	 * @param {Number} z - the z scale
	 * @returns {ThreeQueryResult|scale} - the ThreeQueryResult instance, or the scale of the first object
	 */
	scale(x, y, z) {

		// if no params, return the scale of the first object
		if (x === undefined)
			return this.objects[0]?.scale;

		// scale each object
		this.each(o => o.scale.set(x, y, z));
		return this;
	}


	/**
	 * Either sets the results position, or returns the position of the first object.
	 * 
	 * @param {Number} x - the x position
	 * @param {Number} y - the y position
	 * @param {Number} z - the z position
	 * @returns {ThreeQueryResult|position} - the ThreeQueryResult instance, or the position of the first object
	 */
	pos(x, y, z) {

		// if no params, return the position of the first object
		if (x === undefined) return
			this.objects[0]?.position;

		// set the position of each object
		this.each(o => o.position.set(x, y, z));
		return this;
	}


	/**
	 * Either sets the results rotation, or returns the rotation of the first object.
	 * 
	 * @param {Number|quaternion} x - the x rotation, or a quaternion	
	 * @param {Number} y - the y rotation
	 * @param {Number} z - the z rotation
	 * @returns {ThreeQueryResult|rotation} - the ThreeQueryResult instance, or the rotation of the first object
	 */
	rot(x, y, z) {

		// if no params, return the rotation of the first object
		if (x === undefined)
			return this.objects[0]?.rotation;

		// if we have a quaternion, set it, otherwise set the Euler rotation
		if (typeof x === 'object')
			this.each(o => o.quaternion.copy(x));
		else
			this.each(o => o.rotation.set(x, y, z));
		
		return this;
	}


	/**
	 * Either adjusts the results material(s), or returns the material of the first object.
	 * 
	 * @param {Object} settings - an object with settings to apply to the material
	 * @param {Boolean} applyAll - if true, apply to all materials, otherwise only the first
	 * @returns {ThreeQueryResult|material} - the ThreeQueryResult instance, or the material of the first object
	 */
	material(settings, applyAll = false) {
		
		// if no params, return the material of the first object
		if (!settings) return 
			this.objects[0]?.material;

		// set the material of each object
		this.each(obj => {
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			(applyAll ? mats : [mats[0]]).forEach(mat => {
				Object.entries(settings).forEach(([k, v]) => {
					if (k in mat) mat[k] = v;
					else console.warn(`Property ${k} not in material`);
				});
			});
		});
		return this;
	}


	/**
	 * Toggles the visibility of the objects in the result.
	 * 
	 * @returns {ThreeQueryResult} - the ThreeQueryResult instance
	 */
	toggle() {
		this.each(o => o.visible = !o.visible);
		return this;
	}


	/**
	 * Explicitly sets the visibility of the objects in the result, or returns the visibility of the first object.
	 * 
	 * @param {Boolean} val - if true, show the objects, otherwise hide them
	 * @returns {ThreeQueryResult} - the ThreeQueryResult instance
	 */
	show(val) {

		// if no params, return the visibility of the first object
		if (val === undefined)
			return this.objects[0]?.visible;

		// set the visibility of each object
		this.each(o => o.visible = val);
		return this;
	}


	/**
	 * Either sets the results ID, or returns the ID of the first object.
	 * 
	 * @param {String} newID - the new ID to set
	 * @returns {ThreeQueryResult|id} - the ThreeQueryResult instance, or the ID of the first object
	 */
	id(newID) {

		// if no params, return the ID of the first object
		if (!newID) return
			this.objects[0]?._threeQueryMeta?.id;

		// set the ID of each object
		this.each(obj => {

			// if we don't have a meta object, create one
			const old = obj._threeQueryMeta.id;
			if (old)
				this.root.idMap.get(old)?.splice(this.root.idMap.get(old).indexOf(obj), 1);
			
			// set the new ID
			obj._threeQueryMeta.id = newID;
			obj.userData.name = `#${newID}`;

			// if we have a new ID, add it to our ID map
			if (!this.root.idMap.has(newID))
				this.root.idMap.set(newID, []);
			this.root.idMap.get(newID).push(obj);
		});

		return this;
	}


	/**
	 * Adds a class to the objects in the result.
	 * 
	 * @param {String} cls - the class to add
	 * @returns {ThreeQueryResult} - the ThreeQueryResult instance
	 */
	addClass(cls) {

		// add class to all items in the result
		this.each(obj => {
			obj._threeQueryMeta.classes.add(cls);
			obj.userData.name += ` .${cls}`;

			if (!this.root.classMap.has(cls))
				this.root.classMap.set(cls, []);

			this.root.classMap.get(cls).push(obj);
		});
		return this;
	}


	/**
	 * Removes a class name from the objects in the result.
	 * 
	 * @param {String} cls - the class to remove
	 * @returns {ThreeQueryResult} - the ThreeQueryResult instance
	 */
	removeClass(cls) {

		// remove class from all items in the result
		this.each(obj => {
			obj._threeQueryMeta.classes.delete(cls);
			obj.userData.name = obj.userData.name.replace(new RegExp(`\\.${cls}`), '');
			this.root.classMap.get(cls)?.splice(this.root.classMap.get(cls).indexOf(obj), 1);
		});
		return this;
	}


	/**
	 * Toggles a class on the objects in the result.
	 * 
	 * @param {String} cls - class name to toggle (add if not present, remove if present)
	 * @returns {ThreeQueryResult} - the ThreeQueryResult instance
	 */
	toggleClass(cls) {

		// toggle class on all items in the result
		this.each(obj => {
			if (obj._threeQueryMeta.classes.has(cls))
				this.removeClass(cls);
			else
				this.addClass(cls);
		});
		return this;
	}


	/**
	 * Gets the classes of the first object in the result.
	 * 
	 * @returns {Array} - an array of all classes on the first object
	 */
	class() {
		return [...this.objects[0]?._threeQueryMeta?.classes || []];
	}


	/**
	 * Sets the parent of the objects in the result.
	 * 
	 * @param {Object} newParent - the new parent object
	 * @returns {ThreeQueryResult|Object} - the ThreeQueryResult instance
	 */
	parent(newParent) {

		// if no params, return the parent of the first object
		if (!newParent)
			return this.objects[0]?.parent;

		// set the parent of each object
		const rawParent = newParent instanceof ThreeQueryResult ? newParent.objects[0] : newParent;
		this.each(obj => rawParent.add(obj));
		return this;
	}


	/**
	 * Clones the objects in the result & returns a new ThreeQueryResult instance.
	 * 
	 * @returns {ThreeQueryResult} - a new ThreeQueryResult instance with cloned objects
	 */
	clone() {
		const clones = this.objects.map(o => o.clone(true));
		return new ThreeQueryResult(clones, this.root);
	}


	/**
	 * Gets the raw ThreeJS objects in the result.
	 * 
	 * @returns {Array} - the objects in the result
	 */
	object() {
		return this.objects;
	}
}

export default ThreeQuery;
