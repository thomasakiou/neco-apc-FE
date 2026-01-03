
import { getAllMarkingVenues } from './services/markingVenue';

async function main() {
    try {
        console.log("Fetching marking venues...");
        const venues = await getAllMarkingVenues(true);
        console.log(`Fetched ${venues.length} venues.`);
        if (venues.length > 0) {
            console.log("Sample Venue 1:", JSON.stringify(venues[0], null, 2));
            if (venues.length > 10) {
                console.log("Sample Venue 10:", JSON.stringify(venues[10], null, 2));
            }
        } else {
            console.log("No venues found.");
        }
    } catch (error) {
        console.error("Error fetching venues:", error);
    }
}

main();
