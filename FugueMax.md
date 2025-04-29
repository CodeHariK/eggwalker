# FugueMax CRDT Algorithm Explanation

Yes, I'd be happy to explain the FugueMax CRDT algorithm step-by-step!

FugueMax is a Conflict-free Replicated Data Type (CRDT) algorithm designed for distributed systems to handle conflicts when multiple users make changes concurrently. It's specifically focused on maintaining the maximum value across replicas while handling network partitions and message delays.

## Core Concepts

1. **CRDT (Conflict-free Replicated Data Type)**: Data structures that can be replicated across multiple computers in a network, updated independently, and eventually reconciled automatically.

2. **FugueMax Approach**: Uses a pair of `(value, unique_id)` where:
   - `value` is the numerical value to track
   - `unique_id` is a site-generated unique identifier (often a UUID)

3. **Max Merge Rule**: When comparing two pairs, choose the one with the higher value, or if values are equal, the one with the lexicographically greater unique_id.

## Step-by-Step Algorithm Explanation

### 1. Initialization
- Each site initializes with a starting value (often 0) and generates a unique ID
- State = (0, site_unique_id)

### 2. Local Update
- When a site wants to update to a new value:
  - Create new pair (new_value, site_unique_id)
  - Compare with current state using max merge rule
  - Update local state if new pair is greater

### 3. Merge Operation
- When receiving updates from other sites:
  - Compare incoming state with local state using max merge rule
  - Keep the state with higher value (or higher unique_id if values are equal)

### 4. Convergence
- As sites exchange states, they all eventually converge to the same maximum value across the entire system

Let me provide a diagram to illustrate this:

```mermaid
sequenceDiagram
    participant Site1 as Site 1 (UUID: A123)
    participant Site2 as Site 2 (UUID: B456)
    participant Site3 as Site 3 (UUID: C789)
    
    Note over Site1,Site3: Initialization
    Site1->>Site1: State = (0, A123)
    Site2->>Site2: State = (0, B456)
    Site3->>Site3: State = (0, C789)
    
    Note over Site1: Local Update
    Site1->>Site1: Update to (5, A123)
    
    Note over Site2: Local Update
    Site2->>Site2: Update to (8, B456)
    
    Note over Site1,Site2: Synchronization
    Site1->>Site2: Send (5, A123)
    Site2->>Site1: Send (8, B456)
    
    Note over Site1: Merge
    Site1->>Site1: Compare (5, A123) with (8, B456)
    Site1->>Site1: Keep (8, B456) as 8 > 5
    
    Note over Site2: Merge
    Site2->>Site2: Compare (8, B456) with (5, A123)
    Site2->>Site2: Keep (8, B456) as 8 > 5
    
    Note over Site3: Local Update
    Site3->>Site3: Update to (8, C789)
    
    Note over Site2,Site3: Synchronization
    Site2->>Site3: Send (8, B456)
    Site3->>Site2: Send (8, C789)
    
    Note over Site2: Merge
    Site2->>Site2: Compare (8, B456) with (8, C789)
    Site2->>Site2: Keep (8, C789) as C789 > B456
    
    Note over Site3: Merge
    Site3->>Site3: Compare (8, C789) with (8, B456)
    Site3->>Site3: Keep (8, C789) as C789 > B456
    
    Note over Site1,Site3: Synchronization
    Site1->>Site3: Send (8, B456)
    Site3->>Site1: Send (8, C789)
    
    Note over Site1: Merge
    Site1->>Site1: Compare (8, B456) with (8, C789)
    Site1->>Site1: Keep (8, C789) as C789 > B456
    
    Note over Site1,Site3: System Convergence
    Note over Site1: Final State: (8, C789)
    Note over Site2: Final State: (8, C789)
    Note over Site3: Final State: (8, C789)

```

## Key Advantages of FugueMax

1. **Strong Eventual Consistency**: All replicas converge to the same state after receiving the same set of updates, regardless of order.

2. **Conflict Resolution**: The algorithm automatically resolves conflicts without requiring manual intervention.

3. **Decentralized**: No central authority is needed, making it ideal for distributed systems.

4. **Fault Tolerance**: Continues to function even when some nodes are unreachable.

## Common Applications

- Distributed counters and gauges
- Distributed maximum-tracking systems
- Leader election in distributed systems
- Resource allocation in distributed environments

Would you like me to explain any particular aspect of the FugueMax algorithm in more detail?

```mermaid
sequenceDiagram
    participant Site1 as Site 1 (UUID: A123)
    participant Site2 as Site 2 (UUID: B456)
    participant Site3 as Site 3 (UUID: C789)
    
    Note over Site1,Site3: Initialization
    Site1->>Site1: State = (0, A123)
    Site2->>Site2: State = (0, B456)
    Site3->>Site3: State = (0, C789)
    
    Note over Site1: Local Update
    Site1->>Site1: Update to (5, A123)
    
    Note over Site2: Local Update
    Site2->>Site2: Update to (8, B456)
    
    Note over Site1,Site2: Synchronization
    Site1->>Site2: Send (5, A123)
    Site2->>Site1: Send (8, B456)
    
    Note over Site1: Merge
    Site1->>Site1: Compare (5, A123) with (8, B456)
    Site1->>Site1: Keep (8, B456) as 8 > 5
    
    Note over Site2: Merge
    Site2->>Site2: Compare (8, B456) with (5, A123)
    Site2->>Site2: Keep (8, B456) as 8 > 5
    
    Note over Site3: Local Update
    Site3->>Site3: Update to (8, C789)
    
    Note over Site2,Site3: Synchronization
    Site2->>Site3: Send (8, B456)
    Site3->>Site2: Send (8, C789)
    
    Note over Site2: Merge
    Site2->>Site2: Compare (8, B456) with (8, C789)
    Site2->>Site2: Keep (8, C789) as C789 > B456
    
    Note over Site3: Merge
    Site3->>Site3: Compare (8, C789) with (8, B456)
    Site3->>Site3: Keep (8, C789) as C789 > B456
    
    Note over Site1,Site3: Synchronization
    Site1->>Site3: Send (8, B456)
    Site3->>Site1: Send (8, C789)
    
    Note over Site1: Merge
    Site1->>Site1: Compare (8, B456) with (8, C789)
    Site1->>Site1: Keep (8, C789) as C789 > B456
    
    Note over Site1,Site3: System Convergence
    Note over Site1: Final State: (8, C789)
    Note over Site2: Final State: (8, C789)
    Note over Site3: Final State: (8, C789)
```
