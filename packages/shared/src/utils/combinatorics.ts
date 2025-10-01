export function* combinations<T>(items: T[], choose: number): Generator<T[]> {
  const n = items.length;
  if (choose > n || choose <= 0) {
    return;
  }
  const indices = Array.from({ length: choose }, (_, idx) => idx);

  while (true) {
    yield indices.map((index) => items[index]);

    let i = choose - 1;
    while (i >= 0 && indices[i] === n - choose + i) {
      i -= 1;
    }

    if (i < 0) {
      break;
    }

    indices[i] += 1;
    for (let j = i + 1; j < choose; j += 1) {
      indices[j] = indices[j - 1] + 1;
    }
  }
}
