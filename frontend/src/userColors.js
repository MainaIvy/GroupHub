// Golden-angle hue steps keep neighbouring ids visually distinct; fixed lightness keeps text readable.
export function userColor(id) {
  const hue = Math.round(((Math.abs(Number(id)) || 0) * 137.508) % 360);
  return {
    name: `hsl(${hue} 60% 28%)`,
    bubble: `hsl(${hue} 70% 94%)`,
    border: `hsl(${hue} 45% 78%)`,
    avatar: `hsl(${hue} 55% 88%)`,
  };
}
