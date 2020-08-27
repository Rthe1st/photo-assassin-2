// this file tests behaviour outside of the main game page
// can you join an in progress game, etc

function makeGame(username){
    const url = `${domain}/make?username=${username}&format=json`;
    
    const getData = async url => {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    };
    
    return getData(url);
    
}

