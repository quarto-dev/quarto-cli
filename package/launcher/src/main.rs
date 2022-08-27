use std::{env, path::Path, path::PathBuf};

fn main() {
    // compute base paths
    let exe_path: PathBuf =  env::current_exe().expect("failed to get executable path");
    let bin_path = exe_path.parent().expect("failed to get executable parent");
    let js_path = bin_path.join(Path::new("quarto.js"));
    let importmap_path = bin_path.join("vendor").join("import_map.json");

   

    println!("exe: {}\nbin: {}\n js: {}\nimp: {}", 
        exe_path.display(),
        bin_path.display(),
        js_path.display(),
        importmap_path.display()
    );



   
}
