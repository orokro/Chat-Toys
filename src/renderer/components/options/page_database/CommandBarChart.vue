<!--
	CommandBarChart.vue
	-------------------

	Shows a bar graph for which commands a user has invoked
-->
<template>

	<!-- main outer wrapper -->
	<div style="width: 100%; max-width: 800px; margin: 0 auto;">

		<!-- bar chart via our lib -->
		<Bar 
			:data="chartData" 
			:options="chartOptions" 
		/>
	</div>
</template>
<script setup>

// import our Bay Chart lib deps
import { Bar } from 'vue-chartjs';
import {
	Chart as ChartJS,
	Title,
	Tooltip,
	Legend,
	BarElement,
	CategoryScale,
	LinearScale
} from 'chart.js';


// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);


// define some props
const props = defineProps({

	// array like ['command:count', ...]
	commands: {
		type: Array,
		required: true
	}
});


// Parse into { label, value }
const parsedCommands = props.commands
	.map(item => {
		const [label, value] = item.split(":");
		return { label, value: parseInt(value, 10) };
	})
	.sort((a, b) => a.value - b.value);


// Find max value so we can normalize the data
const maxValue = Math.max(...parsedCommands.map(c => c.value));


// Normalize values (0–1)
const normalizedCommands = parsedCommands
	.map(c => ({
		label: c.label,
		value: c.value / maxValue
	}))
	.sort((a, b) => a.value - b.value);


// Prepare chart data
const chartData = {

	labels: parsedCommands.map(c => c.label),

	datasets: [
		{
			label: 'Normalized Command Usage',
			data: parsedCommands.map(c => c.value),
			backgroundColor: 'rgba(54, 162, 235, 0.7)',
			borderRadius: 5
		}
	]
};



// Build out our ChartJS lib options options
const chartOptions = {
	indexAxis: 'y',
	responsive: true,
	maintainAspectRatio: false,
	scales: {
		x: {
			min: 0,
			max: maxValue, // <- largest command count
			ticks: {
				stepSize: Math.ceil(maxValue / 10) // Optional: control how many ticks
			}
		},
		y: {
			ticks: {
				autoSkip: false
			}
		}
	},
	plugins: {
		legend: {
			display: false
		},
		tooltip: {
			callbacks: {
				label: (context) => {
					return ` ${context.raw} uses`
				}
			}
		}
	}
};

</script>
<style lang="scss" scoped>

	.canvas-container {

		height: 100%;
		min-height: 800px;

	}// .canvas-container

</style>
