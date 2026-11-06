export const parseCard = (c) => ({ suit: c[0], rank: parseInt(c.slice(1), 10), id: c });
