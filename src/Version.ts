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

            if((/(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.test(v1)) &&
               (/(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.test(v2)))
            {

                var v1r = /(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.exec(v1);
                var v2r = /(?<maj>\d{1,2})\.(?<min>\d{1,2})(\-(?<build>\d{1,4}))?/.exec(v1);

                var maj1s = v1r?.groups?.maj;
                var min1s = v1r?.groups?.min;
                var build1s = v1r?.groups?.build;

                var maj2s = v2r?.groups?.maj;
                var min2s = v2r?.groups?.min;
                var build2s = v2r?.groups?.build;

                if(typeof(maj1s)==='undefined') maj1s = '0';
                if(typeof(min1s)==='undefined') min1s = '0';
                if(typeof(build1s)==='undefined') build1s = '0';

                if(typeof(maj2s)==='undefined') maj2s = '0';
                if(typeof(min2s)==='undefined') min2s = '0';
                if(typeof(build2s)==='undefined') build2s = '0';

                const maj1 = parseInt(maj1s);
                const min1 = parseInt(min1s);
                const build1 = parseInt(build1s);

                const maj2 = parseInt(maj2s);
                const min2 = parseInt(min2s);
                const build2 = parseInt(build2s);

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