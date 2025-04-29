/**
 * FugueMax CRDT Implementation
 * 
 * A Conflict-free Replicated Data Type (CRDT) implementation
 * for maintaining maximum values across distributed systems.
 */

/**
 * FugueMax type representing a value with its unique identifier
 */
export type FugueMaxValue<T> = {
    value: T;
    id: string;
};

/**
 * FugueMax class implementation
 * Generic type T must be comparable (typically number or string)
 */
export class FugueMax<T> {
    private state: FugueMaxValue<T>;

    /**
     * Create a new FugueMax instance
     * @param initialValue - The initial value
     * @param id - A unique identifier for this site (defaults to random UUID)
     */
    constructor(initialValue: T, id?: string) {
        this.state = {
            value: initialValue,
            id: id || this.generateUUID()
        };
    }

    /**
     * Generate a random UUID v4
     * @returns A random UUID string
     */
    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Get the current value
     * @returns The current value (without the unique ID)
     */
    getValue(): T {
        return this.state.value;
    }

    /**
     * Get the complete FugueMax state (value and ID)
     * @returns The complete state
     */
    getState(): FugueMaxValue<T> {
        return { ...this.state };
    }

    /**
     * Update the value locally
     * @param newValue - The new value to set
     * @returns true if the value was updated, false otherwise
     */
    update(newValue: T): boolean {
        const newState = {
            value: newValue,
            id: this.state.id
        };

        // Use the merge function to ensure we keep the maximum
        const didChange = this.merge(newState);
        return didChange;
    }

    /**
     * Merge with another FugueMax state
     * This is the key CRDT operation that ensures convergence
     * 
     * @param otherState - The state to merge with
     * @returns true if our state changed as a result, false otherwise
     */
    merge(otherState: FugueMaxValue<T>): boolean {
        // Compare values
        if (this.isGreaterThan(otherState, this.state)) {
            this.state = { ...otherState };
            return true;
        }
        return false;
    }

    /**
     * Determine if one FugueMax state is greater than another
     * 
     * @param a - First state to compare
     * @param b - Second state to compare
     * @returns true if a > b according to FugueMax rules
     */
    private isGreaterThan(a: FugueMaxValue<T>, b: FugueMaxValue<T>): boolean {
        // First compare by value
        if (a.value > b.value) {
            return true;
        }

        // If values are equal, compare by ID
        if (a.value === b.value && a.id > b.id) {
            return true;
        }

        return false;
    }
}

/**
 * FugueMaxNumber is a convenient type alias for the common case of using numbers
 */
export type FugueMaxNumber = FugueMax<number>;

/**
 * Helper function to create a FugueMax instance for numbers
 * @param initialValue - Initial number value (defaults to 0)
 * @param id - Optional unique identifier
 * @returns A new FugueMaxNumber instance
 */
export function createFugueMaxNumber(initialValue: number = 0, id?: string): FugueMaxNumber {
    return new FugueMax<number>(initialValue, id);
}
