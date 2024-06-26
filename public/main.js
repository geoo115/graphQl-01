document.addEventListener("DOMContentLoaded", function () {
    const errorMsg = document.querySelector(".errorMsg");
    const endpoint = "https://learn.01founders.co/api/auth/signin";
    const graphQLEndpoint = "https://learn.01founders.co/api/graphql-engine/v1/graphql";
    const profileQuery = `user { attrs, campus }`;
    const skillGoQuery = `user { transactions(where: {type: {_eq: "skill_go"}}, order_by: {amount: asc}) { createdAt, amount, type, path } }`;
    const xpQuery = `user { xps { amount }, firstName }`;
    const auditRatioQuery = `user { audits(order_by: {createdAt: asc}, where: {grade: {_is_null: false}}) { grade, createdAt } }`;

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
            const [profileData, auditData, xpData, skillData] = await Promise.all([
                fetchGraphQLData(profileQuery, token),
                fetchGraphQLData(auditRatioQuery, token),
                fetchGraphQLData(xpQuery, token),
                fetchGraphQLData(skillGoQuery, token),
            ]);
    
            // Log fetched data to console
            console.log('Profile Data:', profileData);
            console.log('Audit Data:', auditData);
            console.log('XP Data:', xpData);
            console.log('Skill Go Data:', skillData);
    
            // Display data
            displayProfileData(profileData);
            displayXP(xpData.user[0].xps);
            displayRatio(auditData.user[0].audits);
            displaySkillGo(skillData.user[0].transactions);
    
            // Display graphs and tables
            displayGraph(".graphRatioAmount", auditData.user[0].audits, "grade", "blue", "Grade Evolution");
            displayGraph(".graphXpAmount", xpData.user[0].xps, "amount", "green", "XP Evolution");
            displayGraph(".graphSkillAmount", skillData.user[0].transactions, "amount", "red", "Skill Go Evolution");
    
            displayTable(".xpTable", xpData.user[0].xps, ["amount"], "XP Data");
            displayTable(".ratioTable", auditData.user[0].audits, ["createdAt", "grade"], "Ratio Data");
            displayTable(".skillTable", skillData.user[0].transactions, ["createdAt", "amount", "type", "projectName"], "Skill Go Data");
    
        } catch (error) {
            showError("Error fetching data.");
            console.error(error);
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
    
        // Log fetched GraphQL data to console
        console.log('Fetched GraphQL Data:', data);
    
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

    function displayXP(xpData) {
        const totalXP = xpData.reduce((sum, xp) => sum + xp.amount, 0);
        document.querySelector(".XPH1").textContent = `XP: ${totalXP}`;
    }

    function displayRatio(auditData) {
        const totalAudits = auditData.length;
        const totalGrades = auditData.reduce((sum, audit) => sum + audit.grade, 0);
        const averageRatio = totalGrades / totalAudits;
        document.querySelector(".RatioH1").textContent = `Ratio: ${averageRatio.toFixed(2)}`;
    }

 // Function to display Skill Go data
function displaySkillGo(skillData) {
    // Extract project names from paths
    const skillGoProjects = skillData.map(skill => {
        const projectPathParts = skill.path.split('/');
        const projectName = projectPathParts[projectPathParts.length - 1];
        return {
            ...skill,
            projectName
        };
    });

    // Log Skill Go data with project names to console
    console.log('Skill Go Data with Project Names:', skillGoProjects);

    // Calculate total Skill Go amount
    const totalSkillGo = skillGoProjects.reduce((sum, skill) => sum + skill.amount, 0);
    document.querySelector(".SkillH1").textContent = `Skill Go: ${totalSkillGo}`;

    // Display Skill Go data in table
    displayTable(".skillTable", skillGoProjects, ["createdAt", "amount", "type", "projectName"], "Skill Go Data");
}

// Function to display data in a table
function displayTable(containerSelector, data, keys, title) {
    const container = document.querySelector(containerSelector);
    container.innerHTML = `<h3>${title}</h3>`;
    const table = document.createElement("table");

    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    keys.forEach(key => {
        const th = document.createElement("th");
        th.textContent = key;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    data.forEach(item => {
        const tr = document.createElement("tr");
        keys.forEach(key => {
            const td = document.createElement("td");
            td.textContent = item[key] || ''; // Ensure empty cells are handled
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);
}

    function displayGraph(containerSelector, data, key, color, title) {
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

        const x = d3.scaleLinear()
            .domain([0, data.length - 1])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d[key])])
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .call(d3.axisLeft(y));

        const line = d3.line()
            .x((d, i) => x(i))
            .y(d => y(d[key]));

        svg.append("path")
            .datum(data)
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
    }

    function displayTable(containerSelector, data, keys, title) {
        const container = document.querySelector(containerSelector);
        container.innerHTML = `<h3>${title}</h3>`;
        const table = document.createElement("table");
    
        const thead = document.createElement("thead");
        const tr = document.createElement("tr");
        keys.forEach(key => {
            const th = document.createElement("th");
            th.textContent = key;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
    
        const tbody = document.createElement("tbody");
        data.forEach(item => {
            const tr = document.createElement("tr");
            keys.forEach(key => {
                const td = document.createElement("td");
                td.textContent = item[key];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
    
        container.appendChild(table);
    }
    
    

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.style.display = "block";
    }
});
