<template>
	<div ref="wrapper" class="size-fixer-wrapper">
	  <div
		ref="content"
		class="size-fixer-content"
		:style="{
		  transform: `scale(${scale})`,
		  transformOrigin: 'top left',
		  width: naturalSize.width + 'px',
		  height: naturalSize.height + 'px',
		}"
	  >
		<!-- slot rendered only once -->
		<slot />
		<!-- sensor for true unscaled size -->
		<div ref="sensor" class="sensor"></div>
	  </div>
	</div>
  </template>
  
  <script setup>
  import { ref, onMounted, onUnmounted, nextTick } from 'vue'
  
  const wrapper = ref(null)
  const content = ref(null)
  const sensor = ref(null)
  const scale = ref(1)
  const naturalSize = ref({ width: 0, height: 0 })
  
  let parentObserver = null
  let contentObserver = null
  
  const resizeAndScale = () => {
	const parent = wrapper.value?.parentElement
	const sensorEl = sensor.value
  
	if (!parent || !sensorEl) return
  
	const parentRect = parent.getBoundingClientRect()
	const sensorRect = sensorEl.getBoundingClientRect()
  
	naturalSize.value = {
	  width: sensorRect.width,
	  height: sensorRect.height,
	}
  
	const scaleX = parentRect.width / sensorRect.width
	const scaleY = parentRect.height / sensorRect.height
	scale.value = Math.min(scaleX, scaleY, 1)
  }
  
  onMounted(async () => {
	await nextTick()
  
	parentObserver = new ResizeObserver(resizeAndScale)
	contentObserver = new ResizeObserver(resizeAndScale)
  
	if (wrapper.value?.parentElement) {
	  parentObserver.observe(wrapper.value.parentElement)
	}
  
	if (sensor.value) {
	  contentObserver.observe(sensor.value)
	}
  
	resizeAndScale()
  })
  
  onUnmounted(() => {
	parentObserver?.disconnect()
	contentObserver?.disconnect()
  })
  </script>
  
  <style scoped>
  .size-fixer-wrapper {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: visible;
  }
  
  .size-fixer-content {
	position: absolute;
	top: 0;
	left: 0;
  }
  
  /* Sensor element to measure actual content size pre-scale */
  .sensor {
	position: absolute;
	bottom: 0;
	right: 0;
	width: 0;
	height: 0;
	pointer-events: none;
	visibility: hidden;
  }
  </style>
  