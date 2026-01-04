const parseVenue = (venue) => {
    if (!venue) return { code: '', name: 'Unknown', state: 'Unknown' };
    let parts = [];
    if (venue.includes('|')) {
        parts = venue.split('|').map(p => p.trim());
    } else {
        return { code: '', name: venue, state: 'Unknown' };
    }

    if (parts.length >= 3) {
        return { code: parts[0], name: parts[1], state: parts[2] };
    } else if (parts.length === 2) {
        return { code: '', name: parts[0], state: parts[1] };
    }
    return { code: '', name: venue, state: 'Unknown' };
};

const venues = [
    "0202 | HOLY ROSARY S. S. UMUAHIA | ABIA",
    "0201 | ABAYI G. S. S. ABAYI, ABA | ABIA",
    "0101 | SOME SCHOOL | LAGOS",
    "0102 | OTHER SCHOOL | LAGOS",
    "0101 | DUPLICATE CODE | ABIA",
];

const groupedData = {};
venues.forEach(v => {
    groupedData[v] = { details: parseVenue(v) };
});

console.log("Original Order:", Object.keys(groupedData));

const sortedVenueKeys = Object.keys(groupedData).sort((a, b) => {
    const stateA = groupedData[a].details.state.toLowerCase();
    const stateB = groupedData[b].details.state.toLowerCase();

    const stateComparison = stateA.localeCompare(stateB);
    if (stateComparison !== 0) {
        return stateComparison;
    }

    const codeA = groupedData[a].details.code || '';
    const codeB = groupedData[b].details.code || '';
    // console.log(`Comparing ${codeA} vs ${codeB}: ${codeA.localeCompare(codeB)}`);
    return codeA.localeCompare(codeB);
});

console.log("\nSorted Order:");
sortedVenueKeys.forEach(key => {
    const d = groupedData[key].details;
    console.log(`${d.code} | ${d.state} -> ${key}`);
});
