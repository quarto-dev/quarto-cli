import { ProjectScaffoldFile } from "../types.ts";

export const buildConfluenceFiles = (): ProjectScaffoldFile[] => {
  const file: ProjectScaffoldFile[] = [
    {
      name: "index",
      content: `This project provides provides a simple scaffold for creating a Quarto Confluence Project. You'll almost certainly want to remove the sample files, they are just here as examples. When you add you own documents (including ones in subfolders) they will be automatically added to the site navigation sidebar.`,
      title: "Example",
    },
    {
      name: "project-roadmap",
      content: `## Overview

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla id accumsan justo. Nulla ut lectus efficitur, aliquet tellus elementum, hendrerit mi. Aenean risus purus, finibus eu consectetur sit amet, maximus ut tortor. Vivamus congue mollis ante in interdum. In at semper turpis, sed faucibus arcu. Nullam ultrices, neque nec mattis dictum, risus ante mattis diam, sit amet sagittis arcu ante ut urna.

Quisque cursus eros dictum justo varius condimentum a ac risus. Vestibulum sodales, quam quis dignissim scelerisque, tellus turpis mollis sapien, tempor lacinia quam elit at urna. Etiam pharetra sapien at tristique tincidunt. Duis vitae lectus nisl. Proin pharetra, ante a iaculis interdum, lectus massa tempor leo, eu luctus lorem sapien vel sem. Morbi vitae tincidunt libero, eget tincidunt quam.

## Key Milestones

Donec elementum a neque a rutrum. Nulla a quam in eros ornare fringilla at eget mi. Sed dui dolor, porta mollis auctor in, finibus vel tellus. Nunc quis ipsum sit amet magna vulputate tincidunt. Vivamus eget ornare dolor, eget rhoncus purus.

Praesent ac mauris quis magna placerat hendrerit. Fusce viverra nulla nec urna pulvinar semper.

Nunc sit amet libero ut ligula venenatis volutpat. Integer scelerisque iaculis lacus, et ornare velit placerat nec.

Phasellus nisi ante, dignissim quis metus nec, consequat bibendum lacus.`,
      title: "Project Roadmap",
    },
    {
      name: "2022-01",
      subdirectory: "reports",
      title: "January 2022",
      content:
        "## Project Status\n" +
        "Fusce tristique, elit vel tincidunt vehicula, est tortor laoreet sem, nec sagittis ipsum nisl eget ipsum. Ut fringilla facilisis tincidunt:\n" +
        "\n" +
        "1. Cras fermentum sagittis tincidunt. Vestibulum nunc nisi, consequat sed nunc vitae, mollis sodales urna.\n" +
        "2. Curabitur venenatis, sem sed sodales fermentum, ante mauris posuere nisl, eu pretium velit magna a ex. Duis malesuada vitae nisl sit amet aliquam.\n" +
        "3. Nullam scelerisque condimentum leo in convallis. Phasellus eu mauris enim.\n" +
        "\n" +
        "Sed volutpat orci eu ligula gravida, et congue lacus efficitur. Vivamus eget mi nisl. Nam tristique eros nec elit commodo, at vehicula purus venenatis. Donec imperdiet interdum erat at dignissim. Nullam odio ante, pellentesque id commodo et, sodales eget diam.\n" +
        "\n" +
        "## Challenges and Opportunities\n" +
        "In scelerisque non dolor at congue. Donec neque lorem, consectetur sed consectetur ut, pulvinar sit amet justo. Donec at mi erat. Maecenas luctus sem orci, eu ullamcorper arcu porta sed. Nam dapibus risus ligula, non tempor leo convallis vel. Mauris pretium, arcu ut bibendum egestas, nisi tellus cursus tortor, vel interdum turpis ipsum in nisi.\n" +
        "\n" +
        "Aliquam ac egestas mi. Nulla ut porttitor justo. Proin id fermentum nunc:\n" +
        "\n" +
        "1. In odio justo, scelerisque at augue at, blandit rhoncus nibh.\n" +
        "2. Mauris ut tristique elit. Suspendisse pretium tempor mauris non luctus.\n" +
        "3. Mauris posuere nulla purus, quis dapibus urna suscipit ac.\n" +
        "\n" +
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam at risus blandit, aliquet leo sed, pretium lectus. Vivamus in tortor in velit consequat sodales. Integer eleifend dictum vestibulum. Nullam ac augue ultrices, consectetur velit pretium, tincidunt elit. Aliquam mollis nulla erat, vitae scelerisque ante ultrices eu. Fusce maximus libero eget viverra ornare. Proin eu augue placerat, sodales nibh et, laoreet ex.",
    },
    {
      name: "2022-03",
      subdirectory: "reports",
      title: "March 2023",
      content:
        "## Project Status\n" +
        "Sed at auctor lacus, ut porta tellus. Curabitur luctus sem nec ipsum elementum, non congue erat ultrices. Vivamus fringilla nulla lacus, sit amet tincidunt quam cursus vel. Nunc ligula lacus, sollicitudin vitae imperdiet vel, aliquet nec elit.\n" +
        "\n" +
        "Quisque non magna sodales, pellentesque neque quis, varius orci. Aliquam pharetra velit accumsan libero mattis, vitae aliquet justo facilisis. Fusce feugiat tincidunt ante vel lacinia. Curabitur imperdiet cursus iaculis. Nulla posuere neque ac sem euismod pharetra. Morbi massa augue, consectetur sed luctus sagittis, sagittis ac sapien. Sed tempor nisl urna, a sollicitudin tellus rutrum a.\n" +
        "\n" +
        "Challenges and Opportunities\n" +
        "Aenean imperdiet tellus non neque placerat pellentesque. Morbi ac pulvinar arcu. In eget eleifend justo. Pellentesque porttitor consectetur consectetur:\n" +
        "\n" +
        "1. Sed et velit erat.\n" +
        "2. Nunc ullamcorper hendrerit convallis.\n" +
        "3. Curabitur sagittis ex purus.\n" +
        "4. Nulla porta sem sem, vel rutrum tortor.\n" +
        "\n" +
        "Fusce semper est sit amet finibus dictum. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Praesent vehicula, augue eu posuere imperdiet, magna ipsum tristique nisl, ut mollis ipsum ligula sed orci. Sed vitae auctor urna. Fusce pellentesque odio vel enim posuere, sollicitudin viverra quam dictum. Ut eget laoreet eros. Integer vitae imperdiet velit, a cursus lorem.\n" +
        "\n" +
        "Phasellus varius, libero et viverra eleifend, sem orci condimentum turpis, in condimentum sapien est vitae urna. Sed auctor condimentum tortor in egestas. Pellentesque turpis urna, commodo ut ipsum nec, fermentum venenatis risus. Quisque at dictum tortor. Curabitur gravida suscipit nisl, rutrum sagittis mauris ultricies sed.\n" +
        "\n" +
        "Phasellus commodo id nisl sit amet dignissim. Mauris facilisis nunc ut nibh faucibus sagittis. Integer at molestie odio, nec fermentum lectus. Donec quis purus id nisi viverra dapibus vitae eget turpis. Maecenas ut lorem malesuada nunc commodo vulputate. Nunc vulputate quam sapien, eget finibus nunc lobortis vitae. Ut gravida hendrerit lorem vitae consectetur. Quisque eget massa risus. Maecenas fringilla augue congue, lobortis neque sed, consectetur neque. Vivamus auctor nisl et placerat feugiat.",
    },
  ];
  return file;
};
