const saleEndElem = document.getElementById("saleEndDate");
const hoursElem = document.getElementById("hours");
const minutesElem = document.getElementById("minutes");
const secondsElem = document.getElementById("seconds");

if (saleEndElem && hoursElem && minutesElem && secondsElem) {
  const saleEnd = new Date(parseInt(saleEndElem.textContent.trim()) * 1000);

  saleEndElem.textContent = saleEnd.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/(\d{2})[\/.-](\d{2})[\/.-](\d{4}),? ?(\d{2}:\d{2}) ?(AM|PM)?/, (match, d, m, y, t, ap) => {
    return `${d}.${m}.${y}, ${t}${ap ? ' ' + ap : ''}`;
  });

  function updateCountdown() {
    const now = new Date();
    const diff = saleEnd - now;
    
    if (diff <= 0) {
      hoursElem.textContent = "00";
      minutesElem.textContent = "00";
      secondsElem.textContent = "00";
      return;
    }

    const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
    const minutes = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
    const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

    hoursElem.textContent = hours;
    minutesElem.textContent = minutes;
    secondsElem.textContent = seconds;
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();
}