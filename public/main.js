const socket = io();

const loginBtn = document.getElementById('login-btn');
const findGameBtn = document.getElementById('find-game-btn');
const usernameInput = document.getElementById('username');

let myData = null;


loginBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (!name) return alert("Bitte Namen eingeben!");

    socket.emit('login', { username: name, tg_id: null }); 
});

socket.on('loginSuccess', (user) => {
    myData = user;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('lobby-section').style.display = 'block';
    document.getElementById('greeting').innerText = `Hallo, ${user.username}!`;
    document.getElementById('elo-display').innerText = user.elo;
});

findGameBtn.addEventListener('click', () => {
    socket.emit('findGame', myData);
    findGameBtn.innerText = "Suche läuft...";
    findGameBtn.disabled = true;
});

socket.on('matchFound', (data) => {
    console.log("Match gefunden!", data);
    alert("Gegner gefunden! Spiel startet...");

});