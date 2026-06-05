document.addEventListener("DOMContentLoaded", async function () {
    const ctx = document.getElementById("financeChart")?.getContext("2d");
    if (!ctx) return console.error("Canvas with id 'financeChart' not found!");

    try {
        const response = await fetch("/api/finance-summary");
        const data = await response.json();

        const labels = data.map(item => item.description);
        const amounts = data.map(item => parseFloat(item.total_amount));

        const backgroundColors = labels.map(() =>
            `hsl(${Math.floor(Math.random() * 360)}, 70%, 70%)`
        );

        const financeData = {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderColor: "#222",
                borderWidth: 2,
                hoverOffset: 10,
                cutout: "15%"
            }]
        };

        const financeOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#fff",
                        font: {
                            size: 13
                        }
                    }
                },
                tooltip: {
                    enabled: true
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            },
            elements: {
                arc: {
                    borderWidth: 3,
                    borderColor: "#222",
                    shadowColor: "#000",
                    shadowBlur: 10,
                    shadowOffsetX: 5,
                    shadowOffsetY: 5
                }
            }
        };

        new Chart(ctx, {
            type: "doughnut",
            data: financeData,
            options: financeOptions
        });

        
        const infoList = document.getElementById("info-list");
        if (infoList) {
            infoList.innerHTML = "";
            data.forEach((item, index) => {
                const li = document.createElement("li");
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.alignItems = "center";
                li.style.padding = "0.6rem 0";
                li.style.borderBottom = "1px solid rgba(0, 229, 255, 0.1)";
                
                const colorDot = `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${backgroundColors[index]}; margin-right:8px; flex-shrink: 0;"></span>`;
                
                li.innerHTML = `
                    <span style="display: flex; align-items: center; color: var(--text-white); font-size: 0.95rem;">${colorDot} ${item.description}</span>
                    <span style="font-weight: 600; color: var(--primary-cyan); font-size: 0.95rem;">₹${parseFloat(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                `;
                infoList.appendChild(li);
            });
        }

    } catch (err) {
        console.error("Failed to load finance data:", err.message);
    }
});

function toggleMenu() {
    let sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("active");
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}