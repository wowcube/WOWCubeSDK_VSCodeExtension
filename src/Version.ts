import * as vscode from "vscode";

export class Version 
{
    //0 - equal
    //-1 - v1<v2
    //1 - v1>v2
    //2 - error
    public static compare(v1:string, v2:string):Number
    {
        try
        {
            if(v1===v2) { return 0; }

            var v1t = v1.split('.');
            var v2t = v2.split('.');
 
            if(v1t.length===3 && v2t.length===3)
            {
                const maj1 = parseInt(v1t[0]);
                const min1 = parseInt(v1t[1]);
                const build1 = parseInt(v1t[2]);

                const maj2 = parseInt(v2t[0]);
                const min2 = parseInt(v2t[1]);
                const build2 = parseInt(v2t[2]);

                if(maj1>maj2)
                {
                    return 1;
                }
                else
                {
                    if(maj1<maj2)
                    {
                        return -1;
                    }

                    if(min1>min2)
                    {
                        return 1;
                    }
                    else
                    {
                        if(min1<min2)
                        {
                            return -1;
                        }
                        
                        if(build1>build2)
                        {
                            return 1;
                        }
                    }
                }

                return -1;
            }  
        }
        catch(e)
        {
        }

        return 2;
    }
}