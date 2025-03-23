<!--
	LayoutBox.vue
	-------------

	This widget will be a click-and-draggable box that can also
	be sometimes resized.

	It's where our demo-mode widgets will be spawned and moved around
	in the LayoutScreen.vue component.
-->
<template>

	<div 
		class="layoutBox"
		:class="{ editing: props.editing }"
		:style="{
			width: `${width}px`,
			height: `${height}px`,
			left: `${left}px`,
			top: `${top}px`,
			'--handleSize': invScale * 10 + 'px',
			'--halfHandleSize': invScale * 6 + 'px',
			'--borderSize': invScale * 2 + 'px',
			'--borderColor': color,
		}"
		@mousedown="handleDragStart"
	>
		<div
			v-if="props.editing && props.allowResize"
			class="resizeHandles"
		>
			<div class="handle top left" @mousedown="e=>handleResizeDrag(e, ['t', 'l'])"></div>
			<div class="handle top" @mousedown="e=>handleResizeDrag(e, ['t'])"></div>
			<div class="handle top right" @mousedown="e=>handleResizeDrag(e, ['t', 'r'])"></div>
			<div class="handle right" @mousedown="e=>handleResizeDrag(e, ['r'])"></div>
			<div class="handle bottom right" @mousedown="e=>handleResizeDrag(e, ['b', 'r'])"></div>
			<div class="handle bottom" @mousedown="e=>handleResizeDrag(e, ['b'])"></div>
			<div class="handle bottom left" @mousedown="e=>handleResizeDrag(e, ['b', 'l'])"></div>
			<div class="handle left" @mousedown="e=>handleResizeDrag(e, ['l'])"></div>
		</div>

		<!-- the children of this box -->
		<div 
			class="children"
			:class="{ empty: booleanThatsTrueWhenSlotIsEmpty }"
		>
			<slot></slot>
		</div>

		<!-- message to show when empty (no children)-->
		<div class="emptyMsg" v-if="booleanThatsTrueWhenSlotIsEmpty">{{ slug }}</div>
	</div>

</template>
<script setup>

// vue
import { ref, onMounted, computed, useSlots} from 'vue'

// yup, we're using slots
const slots = useSlots();

// accept some props
const props = defineProps({
	
	// options app for state
	optionsApp: {
		type: Object,
		default: null
	},

	// true when this box has editing enabled
	editing: {
		type: Boolean,
		default: false
	},

	// the scale value applied to the layout screen
	scale: {
		type: Number,
		default: 1
	},

	// slug used for identifying the widget this box is for
	slug: {
		type: String,
		default: ''
	},

	// an object like {x: number, y: number, width: number, height: number}
	// that represents the position and size of the box
	boxData: {
		type: Object,
		default: () => ({x: 0, y: 0, width: 100, height: 100})
	},

	// true if we allow resizing
	allowResize: {
		type: Boolean,
		default: false
	},

	// true if we should maintain aspect ratio
	maintainAspectRatio: {
		type: Boolean,
		default: false
	},

	// optional color hinting
	color: {
		type: String,
		default: 'white'
	}
});

// useful inverse scale for moving / resizing / etc
const invScale = computed(() => 1/props.scale);

// emit events
const emit = defineEmits(['change']);

// local refs
const left = ref(props.boxData.x);
const top = ref(props.boxData.y);
const width = ref(props.boxData.width);
const height = ref(props.boxData.height);

// grab local ref to drag helper
const dh = props.optionsApp.dragHelper;

// aspect ratio
let aspectRatio = width.value / height.value;


// used to render box if it's empty
const booleanThatsTrueWhenSlotIsEmpty = computed(() => {

	// if we have no default slot, return true
	const defaultSlot = slots.default?.();
	if (!defaultSlot || defaultSlot.length === 0)
		return true;
	
	// Check if all slot nodes are just whitespace
	return defaultSlot.every(node => {

		// If the node is a text node, check if it's just whitespace
		if (typeof node.children === "string")
			return node.children.trim() === "";
		
		return false;
	});
});


/**
 * When mouse is down over the box, allow it to be dragged
 * 
 * @param event {MouseEvent} - the mousedown event
 */
function handleDragStart(event) {

	// gtfo if we're not editing
	if(!props.editing)
		return;

	// save initial position
	const startPos = {
		left: left.value,
		top: top.value
	};

	dh.dragStart(

		// during move
		(dx, dy) => {

			dx *= invScale.value;
			dy *= invScale.value;

			left.value = startPos.left - dx;
			top.value = startPos.top - dy;
		},

		// upon complete
		(dx, dy) => {

		}
	);
}


/**
 * When mouse is down over a resize handle, allow it to be resized
 * 
 * @param event {MouseEvent} - the mousedown event
 * @param handles {string[]} - an array of strings representing the handles being dragged 
 */
function handleResizeDrag(event, handles) {

	// gtfo if we're not editing
	if(!props.editing)
		return;

	// stop event propagation so we don't drag the box
	event.stopPropagation();
	event.cancelBubble = true;

	// if we have resizing disabled, return
	if(!props.allowResize)
		return;

	// save the initial position
	const startPos = {
		left: left.value,
		top: top.value,
		width: width.value,
		height: height.value
	};

	// true based on sizes
	const isHorizontal = handles.includes('l') || handles.includes('r');
	const izVertical = handles.includes('t') || handles.includes('b');

	// true if we also need to move horizontally / vertically
	const moveHorizontal = handles.includes('l');
	const moveVertical = handles.includes('t');

	// multiplier for width and height (its opposite if we're resizing from the left or top)
	const wMult = moveHorizontal ? -1 : 1;
	const hMult = moveVertical ? -1 : 1;

	// minimum size for the box on either axis
	const minSize = 50;
	const aspectMins = computeAspectMins(aspectRatio, minSize);

	// start the drag
	dh.dragStart(

		// upon move
		(dx, dy) => {

			dx *= invScale.value;
			dy *= invScale.value;

			if(isHorizontal){
				width.value = Math.max(aspectMins.minWidth, startPos.width - (dx * wMult));
				if(props.maintainAspectRatio)
					height.value = aspectMins.getHeight(width.value);
			}
			if(moveHorizontal)
				left.value = Math.min(startPos.left + startPos.width - aspectMins.minWidth, startPos.left + (dx * wMult));

			if(izVertical){
				height.value = Math.max(aspectMins.minHeight, startPos.height - (dy * hMult));
				if(props.maintainAspectRatio)
					width.value = aspectMins.getWidth(height.value);
			}
			if(moveVertical)
				top.value = Math.min(startPos.top + startPos.height - aspectMins.minHeight, startPos.top + (dy * hMult));
		},

		// upon complete
		(dx, dy) => {

		}
	);
}


/**
 * Computes the min sizes for the edges while maintaining aspect ratio
 * 
 * @param aspectRatio {number} - the aspect ratio of the box
 * @param minEdgeSide {number} - the minimum size of the box on either edge
 * @returns {Object} - like {minWidth: number, minHeight: number, getWidth: Function, getHeight: Function}
 */
function computeAspectMins(aspectRatio, minEdgeSide) {

	// return minimum if we're not maintaining aspect ratio
	if(props.maintainAspectRatio==false){
		return {
			minWidth: minEdgeSide,
			minHeight: minEdgeSide,
			getWidth: (newHeight) => newHeight * aspectRatio,
			getHeight: (newWidth) => newWidth / aspectRatio,
		};	
	}

	// compute the minimum width and height based on the aspect ratio
    let minWidth, minHeight;

    // Compute minWidth first assuming it's set to minEdgeSide
    let potentialHeight = minEdgeSide / aspectRatio;
    if (potentialHeight >= minEdgeSide) {

        minWidth = minEdgeSide;
        minHeight = potentialHeight;

    } else {
        // Otherwise, compute the minHeight first
        minHeight = minEdgeSide;
        minWidth = minHeight * aspectRatio;
    }

    return {
        minWidth,
        minHeight,
        getWidth: (newHeight) => Math.max(newHeight * aspectRatio, minWidth),
        getHeight: (newWidth) => Math.max(newWidth / aspectRatio, minHeight),
    };
}

</script>
<style lang="scss" scoped>

	// this will be a box that can be moved around to resize a widget in the layout.
	.layoutBox {

		// layout boxes are positioned abso-lutely
		position: absolute;

		// make box look draggable if editing
		&.editing {

			// dashed color border
			border: var(--borderSize) dashed var(--borderColor);

			cursor: move;
		}
		
		// disable pointer events on children
		.children {

			// fill parent
			position: absolute;
			inset: 0;
			
			// disable pointer events for children
			pointer-events: none;

			// make it transparent color when no children
			&.empty {
				background-color: var(--borderColor);
				opacity: 0.25;

			}// &.empty

			
		}// .children

		// message to show when empty
		.emptyMsg {
			
			// box settings
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);

			// text settings
			font-size: 1.2em;
			font-weight: bold;
			color: white;

		}// .emptyMsg

		// resize handles
		.resizeHandles {

			// individual handle
			.handle {
				
				// fixed on corners & side
				position: absolute;

				// always same size box
				width: var(--handleSize);
				height: var(--handleSize);

				border: 1px solid var(--borderColor);
				background: gray;

				// default position for edge handles
				left: calc(52% - var(--halfHandleSize));
				top: calc(52% - var(--halfHandleSize));

				// corner specific positioning
				&.top { top: calc(var( --halfHandleSize) * -1); }
				&.bottom { top: auto; bottom: calc(var( --halfHandleSize) * -1); }
				&.left { left: calc(var( --halfHandleSize) * -1); }
				&.right { left: auto; right: calc(var( --halfHandleSize) * -1); }

				// resize cursors for specific handles
				&.top, &.bottom { cursor: ns-resize; }
				&.left, &.right { cursor: ew-resize; }
				&.top.left, &.bottom.right { cursor: nwse-resize; }
				&.top.right, &.bottom.left { cursor: nesw-resize; }

			}// .handle

		}// .resizeHandles

	}// .layoutBox

</style>
