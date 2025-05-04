var options = {
    colors: ['#695CFE'],
    series: [{
      name: "Desktops",
      data: [10, 41, 35, 51, 49, 62, 69, 91, 148, 200] //have to be the same amount
  }],
    chart: {
    height: '100%',
    type: 'line',
    zoom: {
      enabled: false
    }
  },
  dataLabels: {
    enabled: false
  },
  stroke: {
    curve: 'smooth',
  },
  title: {
    text: 'Net Worth History',
    align: 'left'
  },
  grid: {
    row: {
      colors: ['#f3f3f3', 'transparent'], // takes an array which will be repeated on columns
      opacity: 0.5
    },
  },
  xaxis: {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'tets'], //time/dates should be implemented here
  }
  };

  var chart = new ApexCharts(document.querySelector("#chart"), options);
  chart.render();