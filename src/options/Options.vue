<template>
	<div>
	  <h2>Extension Settings</h2>
	  <input type="color" v-model="bgColor" @input="saveColor" />
	</div>
  </template>
  
  <script>
  export default {
	name: 'Options',
	data() {
	  return {
		bgColor: '#ffffff'
	  }
	},
	methods: {
	  saveColor() {
		chrome.storage.sync.set({ bgColor: this.bgColor })
	  }
	},
	mounted() {
	  chrome.storage.sync.get('bgColor', ({ bgColor }) => {
		if (bgColor) {
		  this.bgColor = bgColor
		}
	  })
	}
  }
  </script>
  
  <style scoped>
  /* Your component-specific styles */
  </style>
  