/** Length of the straight segment leaving a node perpendicular to its border (room for the symbols). */
export const STUB_LENGTH = 28;

/** Minimum distance between a routed line and any node border (outside the stubs). */
export const OBSTACLE_MARGIN = 12;

/** Extra cost of a bend, expressed in pixels of line length. */
export const BEND_PENALTY = 30;

/** Distance between overlapping segments after they have been separated into lanes. */
export const LANE_SPACING = 8;
