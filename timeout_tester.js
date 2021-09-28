// time-out exerciser and tester

function calc(n){	// this takes some time
	a = 99999;
	while(n-- > 0) a = Math.sqrt(a);
	}

var calcLength = 1000
try {scriptResult("");}	// supress result
catch(err){throw("Timeouts not supported in plugin versions efore 0.3");}
startTime = performance.now();
calc(calcLength);
endTime = performance.now();
lapsed = endTime - startTime;
// print("Lapsed:", lapsed, "ms\n");
calcLength = calcLength/lapsed*1000;
print("Test 1 close to limit: ");
calc(calcLength);
printGreen("OK with ", timeAlloc(), "ms spare\n");
print("Test 2 with extended limit: ");
calc(calcLength);
printGreen("OK with ", timeAlloc(), "ms spare\n");

calc(calcLength);
onSeconds(afterOne, 1);	// run down to near limit
print("Test 3 callback with own limit: ");

function afterOne(length){
	calc(10000);
	printGreen("OK with ", timeAlloc(100), "ms spare\n");
	print("Test 4 expect timeout next - you should not see Test 5\n");
	onSeconds(afterTwo, 2);
	calc(100000000);
	printRed("Test 4 failed to time out\n");
	}

function afterTwo(length){
	printOrange("Test 5 this should never be called!\n");
	}