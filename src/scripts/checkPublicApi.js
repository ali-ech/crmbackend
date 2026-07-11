const res = await fetch('http://localhost:5000/api/public/listings?page=1&sort=newest');
const data = await res.json();
console.log(res.status, data.total, data.listings?.length);
