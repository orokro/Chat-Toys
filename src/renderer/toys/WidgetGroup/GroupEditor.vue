<!--
	GroupEditor.vue
	---------------

	Visual editor for a widget group. Supports zoom, pan, and widget item manipulation.
-->
<template>
	<div 
		class="group-editor-container" 
		@wheel="handleWheel"
		@mousedown="handleMouseDown"
		@contextmenu.prevent
		ref="containerRef"
	>
		<!-- Labels for group dimensions -->
		<div class="dim-label top">{{ group.width }}px</div>
		<div class="dim-label left">{{ group.height }}px</div>

		<div 
			class="editor-viewport"
			:style="{
				transform: `translate(${panX}px, ${panY}px) scale(${zoom})`
			}"
		>
			<!-- The Group Area -->
			<div 
				class="group-area checkered-bg"
				:style="{
					width: group.width + 'px',
					height: group.height + 'px'
				}"
			>
				<!-- Widget Items -->
				<div 
					v-for="(item, index) in group.items" 
					:key="index"
					class="widget-item"
					:class="{ selected: selectedItemIndex === index }"
					:style="{
						left: item.x + 'px',
						top: item.y + 'px',
						width: item.width + 'px',
						height: item.height + 'px',
						'--themeColor': item.color || '#4A90E2'
					}"
					@mousedown.stop="handleItemMouseDown($event, index)"
				>
					<div class="widget-label">{{ item.width }}x{{ item.height }}</div>
					
					<!-- Toolbar -->
					<div class="widget-toolbar">
						<span class="material-icons icon-btn" @click.stop="showChangeWidgetMenu($event, index)">expand_more</span>
						<span class="widget-name">{{ item.name }}</span>
						<span class="material-icons icon-btn delete" @click.stop="removeItem(index)">close</span>
					</div>

					<iframe :src="item.url" class="widget-preview-iframe"></iframe>

					<!-- Resize Handles -->
					<template v-if="selectedItemIndex === index">
						<div class="resizer tl" @mousedown.stop="handleResizeStart($event, index, 'tl')"></div>
						<div class="resizer tr" @mousedown.stop="handleResizeStart($event, index, 'tr')"></div>
						<div class="resizer bl" @mousedown.stop="handleResizeStart($event, index, 'bl')"></div>
						<div class="resizer br" @mousedown.stop="handleResizeStart($event, index, 'br')"></div>
						<div class="resizer t" @mousedown.stop="handleResizeStart($event, index, 't')"></div>
						<div class="resizer r" @mousedown.stop="handleResizeStart($event, index, 'r')"></div>
						<div class="resizer b" @mousedown.stop="handleResizeStart($event, index, 'b')"></div>
						<div class="resizer l" @mousedown.stop="handleResizeStart($event, index, 'l')"></div>
					</template>
				</div>
			</div>
		</div>

		<!-- Add Widget Button -->
		<button class="add-widget-btn" @click="showAddWidgetMenu($event)">
			<span class="material-icons">add</span>
			Add Widget
		</button>

		<!-- Context Menu -->
		<div 
			v-if="contextMenu.show" 
			class="context-menu"
			:style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
			@mousedown.stop
		>
			<div 
				v-for="w in availableWidgets" 
				:key="w.url" 
				class="menu-item"
				@click="handleMenuAction(w)"
			>
				{{ w.toyName }} - {{ w.widgetName }}
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject } from 'vue';
import DragHelper from 'gdraghelper';

const props = defineProps({
	group: {
		type: Object,
		required: true
	}
});

const emit = defineEmits(['update']);

const ctApp = inject('ctApp');
const containerRef = ref(null);
const zoom = ref(0.5);
const panX = ref(100);
const panY = ref(100);
const selectedItemIndex = ref(-1);

const contextMenu = ref({ show: false, x: 0, y: 0, targetIndex: -1 });

const availableWidgets = computed(() => {
	const toys = ctApp.toyManager.toys;
	const result = [];
	for (const slug in toys) {
		const toy = toys[slug];
		if (toy.static.widgetComponents) {
			const urls = toy.getWidgetURLs();
			for (const widget of toy.static.widgetComponents) {
				const urlData = urls.find(u => u.widgetSlug === widget.slug);
				result.push({
					toySlug: toy.slug,
					toyName: toy.static.name,
					widgetName: widget.slug,
					url: urlData?.url,
					color: toy.static.themeColor
				});
			}
		}
	}
	return result;
});

const dh = new DragHelper();

const handleWheel = (e) => {
	e.preventDefault();
	const delta = e.deltaY > 0 ? 0.9 : 1.1;
	zoom.value = Math.max(0.1, Math.min(5, zoom.value * delta));
};

const handleMouseDown = (e) => {
	contextMenu.value.show = false;
	if (e.button === 1 || e.button === 2) {
		const startX = e.clientX;
		const startY = e.clientY;
		const initialPanX = panX.value;
		const initialPanY = panY.value;

		const onMove = (me) => {
			panX.value = initialPanX + (me.clientX - startX);
			panY.value = initialPanY + (me.clientY - startY);
		};

		const onUp = () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	} else {
		selectedItemIndex.value = -1;
	}
};

const handleItemMouseDown = (e, index) => {
	selectedItemIndex.value = index;
	const item = props.group.items[index];
	const startX = item.x;
	const startY = item.y;

	dh.dragStart((dx, dy) => {
		const updatedItems = [...props.group.items];
		updatedItems[index] = {
			...item,
			x: Math.round(startX - dx / zoom.value),
			y: Math.round(startY - dy / zoom.value)
		};
		emit('update', { ...props.group, items: updatedItems });
	});
};

const handleResizeStart = (e, index, type) => {
	const item = props.group.items[index];
	const startX = item.x;
	const startY = item.y;
	const startW = item.width;
	const startH = item.height;

	dh.dragStart((dx, dy) => {
		const adx = dx / zoom.value;
		const ady = dy / zoom.value;
		let nx = startX, ny = startY, nw = startW, nh = startH;

		if (type.includes('r')) nw = Math.max(20, startW - adx);
		if (type.includes('b')) nh = Math.max(20, startH - ady);
		if (type.includes('l')) {
			const potentialW = Math.max(20, startW + adx);
			nx = startX - (potentialW - startW);
			nw = potentialW;
		}
		if (type.includes('t')) {
			const potentialH = Math.max(20, startH + ady);
			ny = startY - (potentialH - startH);
			nh = potentialH;
		}

		const updatedItems = [...props.group.items];
		updatedItems[index] = { ...item, x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) };
		emit('update', { ...props.group, items: updatedItems });
	});
};

const removeItem = (index) => {
	const updatedItems = props.group.items.filter((_, i) => i !== index);
	emit('update', { ...props.group, items: updatedItems });
	if (selectedItemIndex.value === index) selectedItemIndex.value = -1;
};

const showAddWidgetMenu = (e) => {
	const rect = containerRef.value.getBoundingClientRect();
	contextMenu.value = {
		show: true,
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
		targetIndex: -1
	};
};

const showChangeWidgetMenu = (e, index) => {
	const rect = containerRef.value.getBoundingClientRect();
	contextMenu.value = {
		show: true,
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
		targetIndex: index
	};
};

const handleMenuAction = (w) => {
	const updatedItems = [...props.group.items];
	const newItem = {
		name: w.widgetName,
		url: w.url,
		color: w.color,
		x: 100,
		y: 100,
		width: 400,
		height: 300
	};

	if (contextMenu.value.targetIndex === -1) {
		updatedItems.push(newItem);
	} else {
		updatedItems[contextMenu.value.targetIndex] = {
			...updatedItems[contextMenu.value.targetIndex],
			name: w.widgetName,
			url: w.url,
			color: w.color
		};
	}

	emit('update', { ...props.group, items: updatedItems });
	contextMenu.value.show = false;
};

onMounted(() => {
	// Center the group area initially
	if (containerRef.value) {
		const rect = containerRef.value.getBoundingClientRect();
		panX.value = rect.width / 2 - (props.group.width * zoom.value) / 2;
		panY.value = rect.height / 2 - (props.group.height * zoom.value) / 2;
	}
});

onBeforeUnmount(() => {
	dh.end();
});
</script>

<style lang="scss" scoped>
.group-editor-container {
	position: relative;
	width: 100%;
	height: 600px;
	background: #111;
	border: 2px solid black;
	border-radius: 10px;
	overflow: hidden;
	cursor: crosshair;
}

.dim-label {
	position: absolute;
	background: rgba(0,0,0,0.7);
	color: #aaa;
	padding: 2px 6px;
	font-size: 12px;
	pointer-events: none;
	z-index: 10;
	&.top { top: 5px; left: 50%; transform: translateX(-50%); }
	&.left { left: 5px; top: 50%; transform: translateY(-50%) rotate(-90deg); }
}

.editor-viewport {
	position: absolute;
	transform-origin: 0 0;
	pointer-events: none;
}

.group-area {
	position: relative;
	background-color: #222;
	border: 2px dashed #555;
	pointer-events: auto;
}

.checkered-bg {
	background-image: 
		linear-gradient(45deg, #333 25%, transparent 25%), 
		linear-gradient(-45deg, #333 25%, transparent 25%), 
		linear-gradient(45deg, transparent 75%, #333 75%), 
		linear-gradient(-45deg, transparent 75%, #333 75%);
	background-size: 40px 40px;
	background-position: 0 0, 0 20px, 20px -20px, -20px 0px;
}

.widget-item {
	position: absolute;
	border: 2px dashed var(--themeColor);
	background: rgba(0,0,0,0.3);
	cursor: move;
	pointer-events: auto;
	box-sizing: border-box;

	&.selected {
		border-style: solid;
		box-shadow: 0 0 10px var(--themeColor);
		z-index: 5;
	}
}

.widget-preview-iframe {
	width: 100%;
	height: 100%;
	border: none;
	pointer-events: none;
	opacity: 0.8;
}

.widget-label {
	position: absolute;
	bottom: -20px;
	left: 0;
	font-size: 10px;
	color: #888;
}

.widget-toolbar {
	position: absolute;
	top: -25px;
	left: -2px;
	right: -2px;
	height: 25px;
	background: var(--themeColor);
	display: flex;
	align-items: center;
	padding: 0 5px;
	color: white;
	font-size: 12px;
	font-weight: bold;
	border-radius: 4px 4px 0 0;

	.widget-name {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0 5px;
	}

	.icon-btn {
		font-size: 18px;
		cursor: pointer;
		&:hover { opacity: 0.8; }
		&.delete:hover { color: #ff4444; }
	}
}

.resizer {
	position: absolute;
	width: 10px;
	height: 10px;
	background: white;
	border: 1px solid black;
	z-index: 10;

	&.tl { top: -5px; left: -5px; cursor: nwse-resize; }
	&.tr { top: -5px; right: -5px; cursor: nesw-resize; }
	&.bl { bottom: -5px; left: -5px; cursor: nesw-resize; }
	&.br { bottom: -5px; right: -5px; cursor: nwse-resize; }
	&.t { top: -5px; left: calc(50% - 5px); cursor: ns-resize; }
	&.r { right: -5px; top: calc(50% - 5px); cursor: ew-resize; }
	&.b { bottom: -5px; left: calc(50% - 5px); cursor: ns-resize; }
	&.l { left: -5px; top: calc(50% - 5px); cursor: ew-resize; }
}

.add-widget-btn {
	position: absolute;
	top: 10px;
	right: 10px;
	background: #4A90E2;
	color: white;
	border: none;
	border-radius: 5px;
	padding: 8px 12px;
	display: flex;
	align-items: center;
	gap: 5px;
	font-weight: bold;
	cursor: pointer;
	z-index: 20;
	&:hover { background: #357ABD; }
}

.context-menu {
	position: absolute;
	background: #222;
	border: 1px solid #444;
	border-radius: 4px;
	padding: 5px 0;
	z-index: 100;
	min-width: 150px;
	box-shadow: 0 4px 10px rgba(0,0,0,0.5);

	.menu-item {
		padding: 8px 15px;
		color: #eee;
		font-size: 13px;
		cursor: pointer;
		&:hover { background: #444; }
	}
}
</style>
