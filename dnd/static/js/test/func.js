export function exit(text=''){
    console.error(text);
    die();
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}