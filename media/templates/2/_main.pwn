// This PAWN script is generated by WOWCube SDK project wizard

forward run(const pkt[], size, const src[]); // public Pawn function seen from C

// Includes
// -----------------------------

#include "cubios_abi.inc"
#include "trbl.inc"
#include "math.inc"
#include "run.inc"

// Application defines
// -----------------------------
#define DISPLAY_WIDTH   240
#define DISPLAY_HEIGHT  240

#define TEXT_SIZE       8

// WOWCube application callbacks 
// -----------------------------

//Applicaton initialization callback. Called once when CUB application starts
ON_INIT()
{
}

//Main run loop callback. Gets called recurrently by the CUB application as frequent as application code allows. 
ONTICK()
{
    //fill the first screen of each module with red
    abi_CMD_FILL(255,0,0);
    abi_CMD_TEXT("SCREEN 1", 0, DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 - 20, TEXT_SIZE, 0, TEXT_ALIGN_CENTER, 255, 255, 255);
    drawModuleNumber();

    //commit to screen buffer
    abi_CMD_REDRAW(0);
            
            
    //fill the second screen of each module with red
    abi_CMD_FILL(0,255,0);
    abi_CMD_TEXT("SCREEN 2", 0, DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 - 20, TEXT_SIZE, 0, TEXT_ALIGN_CENTER, 255, 255, 255);
    drawModuleNumber()

    //commit to screen buffer
    abi_CMD_REDRAW(1);


    //fill the third screen of each module with red
    abi_CMD_FILL(0,0,255);
    abi_CMD_TEXT("SCREEN 3", 0, DISPLAY_WIDTH / 2,  DISPLAY_HEIGHT / 2 - 20, TEXT_SIZE, 0, TEXT_ALIGN_CENTER, 255, 255, 255);
    drawModuleNumber()

    //commit to screen buffer
    abi_CMD_REDRAW(2);


    // detect device shake and quit application
    // pay attention: 
    //  detecting shakes of each module of a cube is redundant and should not be done; it is enough to choose a single module and continuously perform recurrent checks 
    if (0 == abi_cubeN) 
        {
        abi_checkShake();
        }
}

//The "physics" callback. Gets called recurrently with 30ms resolution. 
ON_PHYSICS_TICK() 
{
}

//The "inner network" callback. Gets called when WOWCube module receives a data packet from other module
ON_CMD_NET_RX(const pkt[])
{
}

ON_LOAD_GAME_DATA()
{
}

//The cube topology change callback. Gets called when cube is twisted and its topological desctiption has been changed
ON_CHECK_ROTATE() 
{
} 

//This callback is obsolete and left here for compatibility purposes only. Do not use it.
RENDER(){}

// User-defined functions
// -----------------------------

drawModuleNumber()
{
   new string[4];  // 4 cells is 16 bytes (16 packed characters including null terminator)
   strformat(string, sizeof(string), true, "MODULE %d", abi_cubeN);
   abi_CMD_TEXT(string, 0, DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 20, TEXT_SIZE, 0, TEXT_ALIGN_CENTER, 255, 255, 255);  
}