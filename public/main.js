document.addEventListener("DOMContentLoaded", function () {
    const errorMsg = document.querySelector(".errorMsg");
    const endpoint = "https://learn.01founders.co/api/auth/signin";
    const graphQLEndpoint = "https://learn.01founders.co/api/graphql-engine/v1/graphql";
    const profileQuery = `user { attrs, campus }`;
    const skillGoQuery = `user { transactions(where: {type: {_eq: "skill_go"}}, order_by: {amount: asc}) { createdAt, amount, type, path } }`;
    const xpQuery = `user { xps { amount, path} }`;
    const auditRatioQuery = `user { audits(order_by: {createdAt: asc}, where: {grade: {_is_null: false}}) { grade, createdAt } }`;
    const londonDiv01ProjectsQuery = `
        user { 
            transactions(where: {path: {_like: "/london/div-01/%"}}, order_by: {createdAt: asc}) { 
                createdAt, amount, type, path 
            } 
        }
    `;
    
    document.querySelector("form").addEventListener("submit", async function (e) {
        e.preventDefault();
        const username = document.querySelector(".name").value;
        const password = document.querySelector(".password").value;

        if (!username || !password) {
            showError("Username and password cannot be empty.");
            return;
        }

        try {
            const token = await authenticateUser(username, password);
            localStorage.setItem("token", JSON.stringify(token));
            await fetchDataAndDisplay(token);
        } catch (error) {
            showError(error.message);
        }
    });

    async function authenticateUser(username, password) {
        const base64 = btoa(`${username}:${password}`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { Authorization: `Basic ${base64}` },
        });

        if (!response.ok) throw new Error("Invalid username or password");

        const tokenData = await response.json();
        if (tokenData.error) throw new Error(tokenData.error);

        return tokenData;
    }

    async function fetchDataAndDisplay(token) {
        try {
            const [profileData, auditData, xpData, skillData, londonDiv01ProjectsData] = await Promise.all([
                fetchGraphQLData(profileQuery, token),
                fetchGraphQLData(auditRatioQuery, token),
                fetchGraphQLData(xpQuery, token),
                fetchGraphQLData(skillGoQuery, token),
                fetchGraphQLData(londonDiv01ProjectsQuery, token),
            ]);

            displayProfileData(profileData);
            displayXP(xpData.user[0].xps);
            displayAuditGraph(auditData.user[0].audits);
            displaySkillGraph(skillData.user[0].transactions);
            displayLondonDiv01Projects(londonDiv01ProjectsData.user[0].transactions);

        } catch (error) {
            console.error(error);
            showError("Failed to fetch user data.");
        }
    }
    
    async function fetchGraphQLData(query, token) {
        const response = await fetch(graphQLEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query: `query { ${query} }` }),
        });

        const data = await response.json();
        if (data.errors) throw new Error(data.errors.map(err => err.message).join(", "));

        return data.data;
    }

    function displayProfileData(data) {
        const user = data.user[0];
        document.querySelector(".loginFormDiv").style.display = "none";
        document.querySelector(".profileDiv").style.display = "flex";

        document.querySelector(".usernameTitle").textContent = `${user.attrs.firstName} ${user.attrs.lastName}`;
        document.querySelector(".userEmail").innerHTML = `<span class='Span'>E-mail: </span>${user.attrs.email}`;
        document.querySelector(".userPhoneNumber").innerHTML = `<span class='Span'>Telephone: </span>${user.attrs.tel}`;
        document.querySelector(".userCampus").innerHTML = `<span class='Span'>Campus: </span>${user.campus}`;
    }

    function displayAuditGraph(audits) {
        const data = audits.map((d, i) => ({ x: new Date(d.createdAt), y: d.grade }));
        createAreaChart(".graphRatioAmount", data, "Audit Grades", "Grades", "Date");
    }
    
    function createAreaChart(containerSelector, data, title, yAxisLabel, xAxisLabel) {
        const container = document.querySelector(containerSelector);
        container.innerHTML = '';
      
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
      
        const svg = d3.select(container)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
      
        const x = d3.scaleTime().domain(d3.extent(data, d => d.x)).range([0, width]);
        const y = d3.scaleLinear().domain([0, d3.max(data, d => d.y)]).nice().range([height, 0]);
      
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")))
            .selectAll("text")  // Select axis label text elements
            .style("font-size", "10px");  // Set font size for x-axis labels
      
        svg.append("g")
            .call(d3.axisLeft(y).ticks(5))
            .selectAll("text")  // Select axis label text elements
            .style("font-size", "10px");  // Set font size for y-axis labels
      
        svg.append("path")
            .datum(data)
            .attr("fill", "steelblue")
            .attr("stroke", "none")
            .attr("d", d3.area()
                .x(d => x(d.x))
                .y0(height)
                .y1(d => y(d.y))
            );
      
        svg.selectAll(".dot")
            .data(data)
            .enter().append("circle")
            .attr("class", "dot")
            .attr("cx", d => x(d.x))
            .attr("cy", d => y(d.y))
            .attr("r", 5)
            .attr("fill", "gold");
      
        // Add value text labels with one decimal place and smaller font size
        svg.selectAll(".text-label")
            .data(data)
            .enter().append("text")
            .attr("class", "text-label")
            .attr("x", d => x(d.x))
            .attr("y", d => y(d.y) - 10)  // Adjust position to place text above the data point
            .attr("text-anchor", "middle")
            .attr("fill", "gold")
            .style("font-size", "8px")  // Set font size for value labels
            .text(d => d.y.toFixed(1));  // Format to one decimal place
      
        // Add chart title with smaller font size
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 0 - margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")  // Set font size for the title
            .style("text-decoration", "underline")
            .text(title);
      
        // Add X axis label with smaller font size
        svg.append("text")
            .attr("transform", `translate(${width / 2},${height + margin.bottom - 10})`)
            .style("text-anchor", "middle")
            .style("font-size", "10px")  // Set font size for x-axis label
            .text(xAxisLabel);
      
        // Add Y axis label with smaller font size
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left + 10)
            .attr("x", 0 - (height / 2))
            .style("text-anchor", "middle")
            .style("font-size", "10px")  // Set font size for y-axis label
            .text(yAxisLabel);
    }
    
    function displayLondonDiv01Projects(data) {
        const projects = data.map(project => {
            const projectPathParts = project.path.split('/');
            const projectName = projectPathParts[projectPathParts.length - 1];
            return {
                ...project,
                projectName
            };
        });
    
        console.log('London Div-01 Project Data with Project Names:', projects);
    
        displayLineChart(".graphXpAmount", projects.filter(d => d.type === 'xp'), "amount", "green", "XP Evolution");
    }
    
    function displayLineChart(containerSelector, data, key, color, title) {
        const container = d3.select(containerSelector);
        container.html("");
    
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
    
        const svg = container.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        // Calculate cumulative XP
        let cumulativeXP = 0;
        const cumulativeData = data.map(d => {
            cumulativeXP += d[key];
            return { ...d, cumulativeXP };
        });
    
        const x = d3.scaleTime()
            .domain(d3.extent(cumulativeData, d => new Date(d.createdAt)))
            .range([0, width]);
    
        const y = d3.scaleLinear()
            .domain([0, d3.max(cumulativeData, d => d.cumulativeXP)])
            .range([height, 0]);
    
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d")).ticks(6));
    
        svg.append("g")
            .call(d3.axisLeft(y));
    
        const line = d3.line()
            .x(d => x(new Date(d.createdAt)))
            .y(d => y(d.cumulativeXP));
    
        svg.append("path")
            .datum(cumulativeData)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("d", line);
    
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 0 - margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("text-decoration", "underline")
            .text(title);
    
        // Remove any existing tooltips to avoid duplicates
        d3.selectAll(".tooltip").remove();
    
        // Create a tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("opacity", 0)
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "10px")
            .style("border-radius", "4px")
            .style("pointer-events", "none");
    
        svg.selectAll("dot")
            .data(cumulativeData)
            .enter().append("circle")
            .attr("r", 5)
            .attr("cx", d => x(new Date(d.createdAt)))
            .attr("cy", d => y(d.cumulativeXP))
            .attr("fill", color)
            .on("mouseover", function (event, d) {
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`XP: ${d.cumulativeXP}<br>Project: ${d.projectName}<br>Date: ${new Date(d.createdAt).toLocaleDateString()}`)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mousemove", function (event) {
                tooltip.style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.transition().duration(500).style("opacity", 0);
            });
    }
    
    // Function to display total XP
    function displayXP(xpData) {
        const totalXP = xpData.reduce((sum, xp) => sum + xp.amount, 0);
        document.querySelector(".XPH1").textContent = `XP: ${totalXP}`;
    }
    
    function createBarChart(containerSelector, data, title, yAxisLabel, xAxisLabel, color = "steelblue") {
        const container = document.querySelector(containerSelector);
        container.innerHTML = '';
      
        const margin = { top: 20, right: 30, bottom: 100, left: 40 }; // Increased bottom margin for labels
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
      
        const svg = d3.select(container)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
      
        const x = d3.scaleBand()
            .domain(data.map(d => d.projectName))
            .range([0, width])
            .padding(0.1);
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.y)])
            .nice()
            .range([height, 0]);
      
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");
      
        svg.append("g")
            .call(d3.axisLeft(y).ticks(5));
      
        // Create bars
        svg.selectAll(".bar")
            .data(data)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.projectName))
            .attr("y", d => y(d.y))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d.y))
            .attr("fill", color);
      
        // Add text labels on top of bars
        svg.selectAll(".bar-label")
            .data(data)
            .enter().append("text")
            .attr("class", "bar-label")
            .attr("x", d => x(d.projectName) + x.bandwidth() / 2)
            .attr("y", d => y(d.y) - 5) // Positioning text slightly above the top of the bar
            .attr("text-anchor", "middle")
            .text(d => d.y)
            .style("font-size", "12px")
            .style("fill", "gold"); // Changed color to gold
    
        // Add chart title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 0 - margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("text-decoration", "underline")
            .text(title);
      
        // Add X axis label
        svg.append("text")
            .attr("transform", `translate(${width / 2},${height + margin.bottom - 10})`)
            .style("text-anchor", "middle")
            .text(xAxisLabel);
      
        // Add Y axis label
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left + 10)
            .attr("x", 0 - (height / 2))
            .style("text-anchor", "middle")
            .text(yAxisLabel);
    }
    

function displaySkillGraph(transactions) {
    const data = transactions.map(d => {
        const projectPathParts = d.path.split('/');
        const projectName = projectPathParts[projectPathParts.length - 1];
        return { x: new Date(d.createdAt), y: d.amount, projectName };
    });
    createBarChart(".graphSkillAmount", data, "Skill GO", "Amount", "Project", "red");
}

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.style.display = "block";
    }
});
