// This PAWN script is generated by WOWCube SDK project wizard

forward run(const pkt[], size, const src[]); // public Pawn function seen from C

// Includes
// -----------------------------

#include "cubios_abi.inc"
#include "trbl.inc"
#include "math.inc"
#include "run.inc"

// WOWCube application callbacks 
// -----------------------------

//Applicaton initialization callback. Called once when CUB application starts
ON_INIT()
{
}

//Main run loop callback. Gets called recurrently by the CUB application as frequent as application code allows. 
ONTICK()
{
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
