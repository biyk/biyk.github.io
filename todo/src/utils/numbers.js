export function toNumber(value) {
    return value == null ? NaN : parseFloat(String(value).replace(',', '.'));
}
