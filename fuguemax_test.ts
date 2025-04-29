import { FugueMax, createFugueMaxNumber } from './fuguemax';

// Example usage in a distributed system simulation

// Create three replicas with different IDs
const site1 = createFugueMaxNumber(0, "site1");
const site2 = createFugueMaxNumber(0, "site2");
const site3 = createFugueMaxNumber(0, "site3");

console.log("Initial states:");
console.log("Site 1:", site1.getState());
console.log("Site 2:", site2.getState());
console.log("Site 3:", site3.getState());

// Site 1 updates to 5
console.log("\nSite 1 updates to 5");
site1.update(5);
console.log("Site 1:", site1.getState());

// Site 2 updates to 8
console.log("\nSite 2 updates to 8");
site2.update(8);
console.log("Site 2:", site2.getState());

// Simulate network sync: Site 1 and Site 2 exchange states
console.log("\nSite 1 and Site 2 sync");
site1.merge(site2.getState());
site2.merge(site1.getState());
console.log("Site 1:", site1.getState());
console.log("Site 2:", site2.getState());

// Site 3 updates to 8 independently
console.log("\nSite 3 updates to 8");
site3.update(8);
console.log("Site 3:", site3.getState());

// Site 2 and 3 sync - both have value 8, but different IDs
console.log("\nSite 2 and Site 3 sync (conflict resolution via ID)");
site2.merge(site3.getState());
site3.merge(site2.getState());
console.log("Site 2:", site2.getState());
console.log("Site 3:", site3.getState());

// Finally, all three sites sync
console.log("\nAll sites sync");
site1.merge(site3.getState());
console.log("Site 1:", site1.getState());
console.log("Site 2:", site2.getState());
console.log("Site 3:", site3.getState());
console.log("\nFinal convergence achieved: All sites have the same state");
